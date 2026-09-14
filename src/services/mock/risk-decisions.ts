import type { OperationContext } from "@/domain/models";
import {
  assessmentRisks,
  canChangeAssessmentDecision,
  hasRiskDecision,
  migrationScope,
} from "@/domain/assessment";
import type { ProjectCommand } from "../contracts";
import { requireCondition } from "../errors";
import { riskStrategyLabels } from "@/shared/i18n/risks";
import { scopeArtifacts, addArtifact } from "./files";
import { riskDecisionUpdates } from "@/domain/risk-decisions";
import type { MockRuntime } from "./runtime";
export function decideRisks(
  rt: MockRuntime,
  c: OperationContext,
  cmd: Extract<
    ProjectCommand,
    { type: "risk.decide" | "risk.recommend" | "risk.ignoreOrExclude" }
  >,
) {
  const s = rt.context(c);
  requireCondition(
    canChangeAssessmentDecision(s),
    "实施准备已开始，策略已锁定；仍可补充验证记录。",
  );
  const ids = [...new Set(cmd.riskIds)];
  const requested = s.risks.filter((r) => ids.includes(r.id));
  requireCondition(
    ids.length &&
      requested.length === ids.length &&
      requested.every((r) => r.stage === "research"),
    "请选择有效的评估风险",
  );
  // Recheck the live snapshot: another conversation may have saved an exception.
  const selected = requested.filter(
    (r) => !cmd.onlyUndecided || !hasRiskDecision(r),
  );
  requireCondition(
    selected.length > 0,
    "这些风险已有策略，本次未覆盖任何选择。请查看最新状态。",
  );
  const updates = riskDecisionUpdates(
    selected,
    cmd.type === "risk.recommend"
      ? "recommended"
      : cmd.type === "risk.ignoreOrExclude"
        ? "ignore-or-exclude"
        : cmd.decision,
    false,
  );
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
    risk.decision = { ...decision, selectedAt: new Date().toISOString() };
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
      : cmd.type === "risk.ignoreOrExclude"
        ? `批量处理 ${selected.length} 条风险：可接受约束项设为忽略，其余设为本次不迁。`
        : `为 ${selected.length} 条风险选择“${riskStrategyLabels[cmd.decision.strategy]}”：${cmd.decision.note.trim()}`,
    { operation: true },
  );
  const preserved = requested.length - selected.length;
  const split =
    cmd.type === "risk.ignoreOrExclude"
      ? `其中 ${updates.filter(({ decision }) => decision.strategy === "ignore").length} 条接受约束，${updates.filter(({ decision }) => decision.strategy === "exclude").length} 条设为本次不迁。`
      : "";
  rt.result(
    c,
    `已保存 ${selected.length} 条风险策略${preserved ? `，保留 ${preserved} 条已有选择` : ""}。${split}当前工具迁移范围为 ${migrationScope(s).length} 台。整改项仍需验证；其余风险可稍后处理，不影响继续规划。`,
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
