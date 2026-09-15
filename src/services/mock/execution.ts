import type { ExecutionTaskKind, OperationContext } from "@/domain/models";
import { migrationScope, migrationMethod } from "@/domain/assessment";
import { canExecute } from "@/domain/policies";
import type { RequestOptions } from "../contracts";
import { requireCondition } from "../errors";
import { buildCreationTasks, buildValidationTasks } from "./fixtures";
import { offerHandoff } from "./handoff";
import type { MockRuntime } from "./runtime";
export async function checkMd(
  rt: MockRuntime,
  c: OperationContext,
  options: RequestOptions,
) {
  const s = rt.context(c);
  requireCondition(
    c.stageId === "migration" && s.batchConfirmation === "confirmed",
    "请先确认规划阶段交接",
  );
  await rt.run(
    c,
    "md-check",
    async (_s, runOptions, runId) => {
      rt.message(
        c,
        "user",
        "检查近端 MD 与迁移环境，排除受阻对象后准备任务。",
        { operation: true },
      );
      s.mdStatus = "checking-connection";
      s.pending[c.conversationId] = {
        startedAt: Date.now(),
        runId,
      };
      rt.publish(s);
      await rt.sleep(900, runOptions);
      s.mdStatus = "checking-config";
      s.mdHistory.push({
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        title: "近端连接正常",
        detail: "源端、目标端与端口组检查中",
      });
      rt.publish(s);
      await rt.sleep(1300, runOptions);
      s.mdStatus = "ready";
      const eligible = new Set(migrationScope(s).map((r) => String(r[0])));
      s.batchTasks = s.batchTasks
        .map((b) => ({
          ...b,
          vmNames: b.vmNames.filter((name) => eligible.has(name)),
        }))
        .filter((b) => b.vmNames.length);
      s.vmTasks = s.vmTasks.filter((v) => eligible.has(v.name));
      s.creationTasks = buildCreationTasks(s.batchTasks).map((task) => ({
        ...task,
        migrationMethod: migrationMethod(s, task.vmName),
      }));
      const count = s.vmTasks.filter(
        (v) =>
          s.batchTasks.find((b) => b.id === v.batchId)?.stageType === "cutover",
      ).length;
      for (const kind of ["creation", "sync", "cutover"] as const) {
        const total =
          kind === "creation"
            ? s.creationTasks.length
            : kind === "sync"
              ? s.batchTasks.length
              : count;
        s.executionMetrics[kind] = {
          total,
          completed: 0,
          running: 0,
          queued: total,
        };
        const id = `execute-${kind}`;
        s.approvals.push({
          id,
          title: {
            creation: "确认新建迁移任务",
            sync: "确认增量同步任务",
            cutover: "确认割接任务",
          }[kind],
          description: "确认目标配置、业务窗口和回退准备后开始执行。",
          checks: ["目标配置已核对", "实施窗口与回退条件已确认"],
          status: "pending",
          action: { kind: "execution", target: kind },
        });
      }
      rt.result(
        c,
        "连接与配置检查通过。三类任务可以分别查看并确认，确认后独立执行。",
        s.approvals
          .filter((a) => a.action.kind === "execution")
          .map((a) => ({ kind: "approval", approvalId: a.id })),
      );
      delete s.pending[c.conversationId];
    },
    options,
  );
}
export async function executeTasks(
  rt: MockRuntime,
  c: OperationContext,
  kind: ExecutionTaskKind,
  options: RequestOptions,
) {
  const s = rt.context(c);
  requireCondition(
    c.stageId === "migration" && canExecute(s, kind),
    "任务已执行或尚未满足前置条件",
  );
  await rt.run(
    c,
    `execute-${kind}`,
    async (_s, runOptions) => {
      rt.message(
        c,
        "user",
        `确认执行${kind === "creation" ? "任务创建" : kind === "sync" ? "数据同步" : "割接任务"}。`,
        { operation: true },
      );
      s.executionApprovals[kind] = true;
      const a = s.approvals.find((a) => a.id === `execute-${kind}`);
      if (a) a.status = "confirmed";
      const ids =
        kind === "creation"
          ? s.creationTasks.map((t) => t.id)
          : kind === "cutover"
            ? s.vmTasks
                .filter(
                  (v) =>
                    s.batchTasks.find((b) => b.id === v.batchId)?.stageType ===
                    "cutover",
                )
                .map((v) => v.id)
            : s.batchTasks.map((b) => b.id);
      rt.result(
        c,
        "任务已确认并开始执行。可以继续处理其他事项，进度会同步更新。",
        [
          {
            kind: "tasks",
            title: {
              creation: "新建任务",
              sync: "增量同步任务",
              cutover: "割接任务",
            }[kind],
            taskIds: ids,
            taskKind: kind,
          },
        ],
      );
      const metric = s.executionMetrics[kind];
      metric.running = Math.min(2, metric.total - metric.completed);
      metric.queued = metric.total - metric.completed - metric.running;
      rt.publish(s);
      const remaining = ids.filter((id, index) =>
        kind === "creation"
          ? s.creationTasks.find((t) => t.id === id)?.status !== "created"
          : kind === "cutover"
            ? !s.validationTasks.some((t) => t.sourceTaskId === id)
            : index >= metric.completed,
      );
      for (const id of remaining) {
        await rt.sleep(1400, runOptions);
        metric.completed++;
        metric.running = Math.min(2, metric.total - metric.completed);
        metric.queued = metric.total - metric.completed - metric.running;
        if (kind === "creation")
          s.creationTasks
            .filter((t) => t.id === id)
            .forEach((t) => (t.status = "created"));
        if (kind === "cutover") {
          const v = s.vmTasks.find((v) => v.id === id);
          if (v) {
            v.status = "succeeded";
            v.progress = 100;
            v.checkStatus = "passed";
            const validation = buildValidationTasks([v], s.batchTasks)[0];
            if (!s.validationTasks.some((t) => t.id === validation.id))
              s.validationTasks.push(validation);
          }
        }
        if (kind === "cutover") offerHandoff(rt, c);
        rt.publish(s);
      }
      rt.notice(
        c,
        kind === "cutover"
          ? "已有割接结果，人工确认交接后可进入结果验证"
          : "任务已完成",
      );
    },
    options,
  );
}
