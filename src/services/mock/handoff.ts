import type { OperationContext } from "@/domain/models";
import { stageEligibility } from "@/domain/policies";
import { stageName } from "@/shared/i18n/stages";
import type { MockRuntime } from "./runtime";
export function offerHandoff(rt: MockRuntime, c: OperationContext) {
  const s = rt.state(c.projectId);
  const order = ["research", "planning", "migration", "validation"] as const;
  const next = order[order.indexOf(s.enteredStages.at(-1) ?? "research") + 1];
  if (
    !next ||
    !stageEligibility(s)[next] ||
    s.approvals.some((a) => a.id === `enter-${next}`)
  )
    return;
  const a = {
    id: `enter-${next}`,
    title: `进入${stageName[next]}`,
    description: "保留现有会话与任务，人工确认后创建新阶段会话。",
    checks:
      next === "planning"
        ? ["评估已完成", "评估高风险已闭环"]
        : next === "migration"
          ? ["批次计划已生成", "规划高风险已闭环"]
          : ["已有割接结果", "进入验证不影响其余实施任务"],
    status: "pending" as const,
    action: { kind: "stage" as const, target: next },
  };
  s.approvals.push(a);
  rt.result(c, "当前阶段已满足交接条件，请查看并人工确认。", [
    { kind: "approval", approvalId: a.id },
  ]);
}
