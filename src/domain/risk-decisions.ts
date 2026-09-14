import type { ProjectSnapshot, RiskDecision, RiskItem } from "./models";
import { hasRiskDecision, migrationScope } from "./assessment";

export type RiskDecisionDraft = Omit<RiskDecision, "selectedAt">;
export type BulkRiskAction = "recommended" | "ignore-or-exclude" | "exclude";

/** Shared by the confirmation preview and service; does not mutate the snapshot. */
export function riskDecisionUpdates(
  risks: RiskItem[],
  action: BulkRiskAction | RiskDecisionDraft,
  onlyUndecided = true,
) {
  return risks
    .filter((r) => !onlyUndecided || !hasRiskDecision(r))
    .map((risk) => {
      let decision: RiskDecisionDraft;
      if (typeof action !== "string")
        decision = { ...action, note: action.note.trim() };
      else if (action === "recommended")
        decision = {
          strategy: risk.recommendedStrategy!,
          method: risk.recommendedMethod!,
          note: risk.recommendation ?? "",
        };
      else if (action === "ignore-or-exclude" && risk.impact === "constraint")
        decision = {
          strategy: "ignore",
          method: risk.recommendedMethod === "agent" ? "agent" : "agentless",
          note: "接受评估约束，迁移时继续遵守相关限制。",
        };
      else
        decision = {
          strategy: "exclude",
          method: "manual",
          note:
            action === "ignore-or-exclude"
              ? "该风险不能直接忽略，关联虚拟机本次不迁。"
              : "批量设为本次不迁，从工具迁移范围排除。",
        };
      return { risk, decision };
    });
}

export function previewRiskDecisions(
  snapshot: ProjectSnapshot,
  risks: RiskItem[],
  action: BulkRiskAction,
  onlyUndecided: boolean,
) {
  const updates = riskDecisionUpdates(risks, action, onlyUndecided);
  const byId = new Map(
    updates.map(({ risk, decision }) => [risk.id, decision]),
  );
  const projected = {
    ...snapshot,
    risks: snapshot.risks.map((risk) => {
      const decision = byId.get(risk.id);
      return decision
        ? { ...risk, closed: false, decision: { ...decision, selectedAt: "" } }
        : risk;
    }),
  };
  return {
    total: updates.length,
    preserved: risks.length - updates.length,
    overwritten: updates.filter(({ risk }) => hasRiskDecision(risk)).length,
    verified: updates.filter(({ risk }) => risk.closed).length,
    ignored: updates.filter(({ decision }) => decision.strategy === "ignore")
      .length,
    excluded: updates.filter(({ decision }) => decision.strategy === "exclude")
      .length,
    excludedVms: snapshot.scopeRows.length - migrationScope(projected).length,
  };
}
