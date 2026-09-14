import {
  createStageConversation,
  type OperationContext,
} from "@/domain/models";
import { stageEligibility } from "@/domain/policies";
import { stageName } from "@/shared/i18n/stages";
import type { ProjectCommand, RequestOptions } from "../contracts";
import { ServiceError, requireCondition } from "../errors";
import { assess } from "./assessment";
import { checkMd, executeTasks } from "./execution";
import { buildValidationTasks } from "./fixtures";
import { decideRisks } from "./risk-decisions";
import { canChangeAssessmentDecision } from "@/domain/assessment";
import { scopeArtifacts } from "./files";
import { offerHandoff, reviewHandoff } from "./handoff";
import { plan } from "./planning";
import type { MockRuntime } from "./runtime";
export async function command(
  rt: MockRuntime,
  c: OperationContext,
  cmd: ProjectCommand,
  options: RequestOptions,
) {
  if (options.signal?.aborted) throw new ServiceError("ABORTED", "操作已取消");
  const s = rt.context(c);
  requireCondition(s.info, "请先创建项目");
  if (cmd.type === "assessment.start") return assess(rt, c, options);
  if (cmd.type === "planning.useSample")
    return plan(rt, c, "迁移规划信息-示例.xlsx", options);
  if (cmd.type === "md.check") return checkMd(rt, c, options);
  if (cmd.type === "execution.confirm") {
    await executeTasks(rt, c, cmd.kind, options);
    offerHandoff(rt, c);
    rt.publish(s);
    return;
  }
  switch (cmd.type) {
    case "risk.decide":
    case "risk.recommend":
    case "risk.ignoreOrExclude":
      decideRisks(rt, c, cmd);
      break;
    case "assessment.choosePlan":
      requireCondition(
        canChangeAssessmentDecision(s),
        "实施准备已开始，策略已锁定；仍可补充验证记录。",
      );
      requireCondition(
        ["hybrid", "agentless", "custom"].includes(cmd.plan.mode),
        "请选择迁移方案",
      );
      requireCondition(
        cmd.plan.mode !== "custom" || cmd.plan.note.trim().length >= 4,
        "请填写自定义迁移方案",
      );
      s.assessmentPlan = {
        ...cmd.plan,
        note: cmd.plan.note.trim().slice(0, 500),
      };
      rt.message(
        c,
        "user",
        `选择迁移方案：${cmd.plan.mode === "hybrid" ? "混合迁移" : cmd.plan.mode === "agentless" ? "免代理优先" : "自定义方案"}。${s.assessmentPlan.note}`,
        { operation: true },
      );
      rt.result(
        c,
        "总体方案已记录。你可以按类别调整具体策略，也可以直接继续规划。\n\n尚未满足迁移条件的对象会自动排除，不会因为跳过确认而进入实施；可迁对象的注意事项会继续保留。",
        [],
      );
      break;
    case "stage.review":
      reviewHandoff(rt, c, cmd.target);
      break;
    case "assessment.useSamples":
      requireCondition(
        c.stageId === "research" &&
          ["idle", "ready"].includes(s.assessmentStatus),
        "评估资料已锁定",
      );
      s.files = {
        rvtools: "RVTools-示例资产.xlsx",
        presales: "迁移调研表-示例.xlsx",
      };
      s.assessmentStatus = "ready";
      rt.message(c, "user", "使用示例 RVTools 采集表和迁移调研表。", {
        operation: true,
        activity: "assessment-preparation",
      });
      rt.result(
        c,
        "两份示例资料已就绪。RVTools 用于核对源端配置，调研表补充目标平台、应用和硬件信息。\n\n开始后，我会先解释整体可行性，再给出按虚拟机和风险类别的处置建议。",
        [{ kind: "assessment-input", files: { ...s.files } }],
        { activity: "assessment-preparation" },
      );
      break;
    case "planning.confirmScope":
      requireCondition(
        c.stageId === "planning" && s.planningStatus === "scope-review",
        "范围已确认或尚未进入规划",
      );
      s.planningStatus = "details-pending";
      rt.message(c, "user", "确认当前可迁范围，继续补充规划信息。", {
        operation: true,
      });
      rt.result(
        c,
        "范围已确认。受阻对象保持排除，请补充业务属性、依赖关系和迁移窗口，再生成批次。",
        [],
      );
      break;
    case "planning.requestAdjustment":
      requireCondition(
        s.planningStatus === "completed" && s.batchConfirmation !== "confirmed",
        "请先完成规划，已确认的批次不能重复调整",
      );
      s.batchConfirmation = "adjusting";
      rt.message(
        c,
        "agent",
        "请补充批次调整要求。当前模拟保留已有批次，真实接入后由规划服务重新计算。",
      );
      break;
    case "stage.confirm": {
      const order = ["research", "planning", "migration", "validation"];
      requireCondition(
        order.indexOf(cmd.target) ===
          order.indexOf(s.enteredStages.at(-1) ?? "research") + 1 &&
          stageEligibility(s)[cmd.target],
        "阶段交接条件尚未满足",
      );
      requireCondition(!s.enteredStages.includes(cmd.target), "该阶段已经进入");
      s.enteredStages.push(cmd.target);
      const chat = createStageConversation(cmd.target);
      s.conversations.push(chat);
      const approval = s.approvals.find((a) => a.id === `enter-${cmd.target}`);
      if (approval) approval.status = "confirmed";
      if (cmd.target === "planning") {
        s.planningStatus = "scope-review";
        scopeArtifacts(rt, s);
      }
      if (cmd.target === "migration") s.batchConfirmation = "confirmed";
      rt.message(
        c,
        "user",
        `已人工确认阶段交接，进入${stageName[cmd.target]}。`,
        { operation: true },
      );
      rt.message(
        { ...c, stageId: cmd.target, conversationId: chat.id },
        "agent",
        cmd.target === "planning"
          ? "请先核对迁移范围，再填写业务依赖和迁移窗口。"
          : cmd.target === "migration"
            ? "请检查近端 MD 的连接、源端和目标端配置，再确认任务。"
            : "请核对配置对比结果，逐台或批量完成人工验收。",
      );
      break;
    }
    case "creation.update": {
      requireCondition(
        c.stageId === "migration" &&
          s.mdStatus === "ready" &&
          !s.executionApprovals.creation,
        "任务已经执行或配置尚未开放",
      );
      requireCondition(
        cmd.tasks.length > 0 &&
          cmd.tasks.every((t) => s.creationTasks.some((v) => v.id === t.id)),
        "未找到任务",
      );
      if (cmd.create) {
        requireCondition(
          s.creationTasks.every((t) => t.status !== "unconfigured"),
          "请先确认全部任务配置",
        );
        return executeTasks(rt, c, "creation", options);
      }
      s.creationTasks = s.creationTasks.map((t) => {
        const next = cmd.tasks.find((n) => n.id === t.id);
        return next ? { ...next, status: "confirmed" } : t;
      });
      rt.message(c, "user", `已确认配置 ${cmd.tasks.length} 个迁移任务。`, {
        operation: true,
      });
      break;
    }
    case "cutover.complete": {
      requireCondition(
        c.stageId === "migration" &&
          s.mdStatus === "ready" &&
          !s.executionApprovals.cutover,
        "割接任务正在执行或条件未满足",
      );
      const tasks = s.vmTasks.filter(
        (v) =>
          cmd.taskIds.includes(v.id) &&
          s.batchTasks.find((b) => b.id === v.batchId)?.stageType ===
            "cutover" &&
          !s.validationTasks.some((t) => t.sourceTaskId === v.id),
      );
      requireCondition(tasks.length, "所选任务已完成，请勿重复提交");
      tasks.forEach((v) => {
        v.status = "succeeded";
        v.progress = 100;
        v.checkStatus = "passed";
      });
      s.validationTasks.push(...buildValidationTasks(tasks, s.batchTasks));
      s.executionMetrics.cutover.completed = s.validationTasks.length;
      rt.result(c, "所选割接任务已完成，配置对比已生成。", [
        {
          kind: "tasks",
          title: "割接结果",
          taskIds: tasks.map((v) => v.id),
          taskKind: "cutover",
        },
      ]);
      break;
    }
    case "validation.confirm":
      requireCondition(
        s.enteredStages.includes("validation"),
        "请先人工确认进入验证阶段",
      );
      requireCondition(
        cmd.taskIds.some((id) =>
          s.validationTasks.some((v) => v.id === id && !v.confirmed),
        ),
        "所选验证已完成",
      );
      s.validationTasks.forEach((v) => {
        if (cmd.taskIds.includes(v.id)) v.confirmed = true;
      });
      rt.message(
        c,
        "user",
        `已人工确认 ${cmd.taskIds.length} 台虚拟机验证通过。`,
        { operation: true },
      );
      break;
    case "risk.close": {
      const risk = s.risks.find((r) => r.id === cmd.riskId);
      requireCondition(risk && !risk.closed, "风险已闭环或不存在");
      requireCondition(
        cmd.description.trim().length >= 4,
        "请填写至少 4 字的整改验证依据",
      );
      if (risk.stage === "research")
        requireCondition(
          risk.decision &&
            ["remediate", "custom"].includes(risk.decision.strategy),
          "请先选择整改或自定义方案，再提交验证依据",
        );
      risk.closed = true;
      risk.closedAt = new Date().toISOString();
      risk.closureDescription = cmd.description.trim();
      if (risk.stage === "research") scopeArtifacts(rt, s);
      rt.message(
        c,
        "user",
        `提交 R-${risk.id} 的整改验证：${cmd.description.trim()}`,
        { operation: true },
      );
      rt.result(
        c,
        "整改验证依据已记录，原始评估发现仍保留供追溯。此为人工确认，系统未重新执行真实兼容性检查。",
        [],
      );
      break;
    }
    case "tasks.action": {
      requireCondition(
        !Object.entries(s.operations).some(
          ([k, v]) => k.startsWith("execute-") && v === "running",
        ),
        "任务执行期间不可修改，请等待当前操作结束",
      );
      const tasks = s.vmTasks.filter((t) => cmd.taskIds.includes(t.id));
      requireCondition(tasks.length, "未找到所选任务");
      if (cmd.action === "delete")
        s.vmTasks = s.vmTasks.filter((t) => !cmd.taskIds.includes(t.id));
      else
        tasks.forEach((t) => {
          if (cmd.action === "pause") t.status = "paused";
          else if (cmd.action === "sync") t.status = "syncing";
          else t.remaining = cmd.action === "schedule" ? "scheduled" : "—";
        });
      rt.message(
        c,
        "system",
        `任务操作已记录：${cmd.action} · ${tasks.length}`,
        { operation: true },
      );
      break;
    }
  }
  offerHandoff(rt, c);
  rt.publish(s);
}
