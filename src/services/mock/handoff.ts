import type { OperationContext, StageId } from "@/domain/models";
import { stageEligibility } from "@/domain/policies";
import { migrationScope } from "@/domain/assessment";
import { stageName } from "@/shared/i18n/stages";
import { requireCondition } from "../errors";
import type { MockRuntime } from "./runtime";
const order: StageId[] = ["research", "planning", "migration", "validation"];
function upsertApproval(rt: MockRuntime, c: OperationContext, next: StageId) {
  const s = rt.state(c.projectId);
  const included = migrationScope(s).length;
  const checks =
    next === "planning"
      ? [
          s.assessmentStatus === "completed"
            ? "评估报告已生成"
            : "请先完成调研评估",
          `当前可纳入工具迁移 ${included} 台，暂时排除 ${s.scopeRows.length - included} 台`,
          "未选择策略也可以继续；受阻对象不进入实施，迁移约束继续保留",
        ]
      : next === "migration"
        ? [
            s.planningStatus === "completed"
              ? "批次计划已生成"
              : "请先完成批次规划",
            "实施前按最新风险状态再次过滤，未通过整改验证的对象不创建工具任务",
          ]
        : [
            s.validationTasks.length
              ? "已有割接结果可核对"
              : "请先完成至少一项割接",
            "进入验证不影响其余实施任务",
          ];
  const existing = s.approvals.find((a) => a.id === `enter-${next}`);
  if (existing) {
    existing.checks = checks;
    return existing;
  }
  const approval = {
    id: `enter-${next}`,
    title: `进入${stageName[next]}`,
    description:
      "保留现有会话与风险记录，确认后创建下一阶段主会话。风险处置是可选操作，受阻对象自动排除。",
    checks,
    status: "pending" as const,
    action: { kind: "stage" as const, target: next },
  };
  s.approvals.push(approval);
  return approval;
}
export function reviewHandoff(
  rt: MockRuntime,
  c: OperationContext,
  target: StageId,
) {
  const s = rt.context(c);
  requireCondition(
    target === order[order.indexOf(s.enteredStages.at(-1) ?? "research") + 1],
    "请按阶段顺序继续",
  );
  const a = upsertApproval(rt, c, target);
  rt.message(c, "user", `查看进入${stageName[target]}的范围与交接事项。`, {
    operation: true,
  });
  const ready = stageEligibility(s)[target];
  rt.result(
    c,
    ready
      ? `可以继续${stageName[target]}，不需要逐项确认风险。\n\n${a.checks.join("。")}。请确认以下交接事项，或继续留在当前会话答疑。`
      : "当前还未完成必要的阶段工作。你可以先查看交接条件；不需要为了继续而逐项确认风险。",
    [{ kind: "approval", approvalId: a.id }],
  );
}
export function offerHandoff(rt: MockRuntime, c: OperationContext) {
  const s = rt.state(c.projectId);
  const next = order[order.indexOf(s.enteredStages.at(-1) ?? "research") + 1];
  if (!next || !stageEligibility(s)[next]) return;
  upsertApproval(rt, c, next);
}
