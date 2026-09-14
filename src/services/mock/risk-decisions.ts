import type { OperationContext } from "@/domain/models";
import {
  assessmentRisks,
  canChangeAssessmentDecision,
  migrationScope,
} from "@/domain/assessment";
import type { ProjectCommand } from "../contracts";
import { requireCondition } from "../errors";
import { riskStrategyLabels } from "@/shared/i18n/risks";
import { scopeArtifacts, addArtifact } from "./files";
import type { MockRuntime } from "./runtime";
export function decideRisks(
  rt: MockRuntime,
  c: OperationContext,
  cmd: Extract<ProjectCommand, { type: "risk.decide" | "risk.recommend" }>,
) {
  const s = rt.context(c);
  requireCondition(
    canChangeAssessmentDecision(s),
    "实施准备已开始，策略已锁定；仍可补充验证记录。",
  );
  const ids = [...new Set(cmd.riskIds)];
  const selected = s.risks.filter((r) => ids.includes(r.id));
  requireCondition(
    ids.length &&
      selected.length === ids.length &&
      selected.every((r) => r.stage === "research"),
    "请选择有效的评估风险",
  );
  const updates = selected.map((r) => ({
    risk: r,
    decision:
      cmd.type === "risk.recommend"
        ? {
            strategy: r.recommendedStrategy!,
            method: r.recommendedMethod!,
            note: r.recommendation!,
            selectedAt: new Date().toISOString(),
          }
        : {
            ...cmd.decision,
            note: cmd.decision.note.trim(),
            selectedAt: new Date().toISOString(),
          },
  }));
  for (const { risk, decision: d } of updates) {
    requireCondition(
      ["ignore", "remediate", "exclude", "custom"].includes(d.strategy) &&
        ["agentless", "agent", "manual"].includes(d.method),
      "请选择有效处置方式",
    );
    requireCondition(
      d.note.length >= 4 && d.note.length <= 500,
      "请填写 4 至 500 字的策略说明",
    );
    requireCondition(
      d.strategy !== "ignore" || risk.impact === "constraint",
      "无法忽略迁移阻塞或整改项，请选择整改、不迁或自定义策略",
    );
    requireCondition(
      d.strategy !== "remediate" || d.method !== "manual",
      "另行迁移或重建请使用自定义策略",
    );
  }
  updates.forEach(({ risk, decision }) => {
    risk.decision = decision;
    // Replacing a plan does not carry over verification of a different plan.
    risk.closed = false;
    risk.closedAt = "—";
    risk.closureDescription = "";
  });
  rt.message(
    c,
    "user",
    cmd.type === "risk.recommend"
      ? `采用所选 ${selected.length} 条风险的建议处置方案。`
      : `为 ${selected.length} 条风险选择“${riskStrategyLabels[cmd.decision.strategy]}”：${cmd.decision.note.trim()}`,
    { operation: true },
  );
  const remaining = assessmentRisks(s).filter((r) => !r.decision).length;
  rt.result(
    c,
    `已保存这 ${selected.length} 条风险的处置方案。${remaining ? `还有 ${remaining} 条待选择。` : "所有评估风险均已选择方案。"}\n\n接受约束会保留原始发现；“整改后迁移”仍需在实施前提交验证依据。本次不迁或另行重建的虚拟机不进入工具任务，当前工具范围为 ${migrationScope(s).length} 台。`,
    [],
  );
  scopeArtifacts(rt, s);
  addArtifact(
    rt,
    s,
    "risk-decisions",
    "风险处置方案",
    assessmentRisks(s)
      .map(
        (r) =>
          `${r.vmName} · ${r.description}\n${r.decision ? riskStrategyLabels[r.decision.strategy] + "：" + r.decision.note : "待选择策略"}`,
      )
      .join("\n\n"),
    "plan",
    "research",
    "md",
  );
}
