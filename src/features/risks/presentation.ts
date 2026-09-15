import type { RiskItem } from "@/domain/models";
import { hasRiskDecision } from "@/domain/assessment";
import { riskCategoryLabels, riskStrategyLabels } from "@/shared/i18n/risks";

export interface RiskLocation {
  mode: "category" | "vm";
  category?: string;
  vmKey?: string;
}
export const vmKey = (risk: RiskItem) =>
  risk.vmId && risk.vmId !== "—" ? `id:${risk.vmId}` : `name:${risk.vmName}`;
export const categoryKey = (risk: RiskItem) => risk.category ?? risk.stage;
export const undecidedRisks = (risks: RiskItem[]) =>
  risks.filter((r) => r.stage === "research" && !hasRiskDecision(r));
export const vmCount = (risks: RiskItem[]) => new Set(risks.map(vmKey)).size;
export const highestRiskLevel = (risks: RiskItem[]): RiskItem["level"] =>
  risks.some((r) => r.level === "high")
    ? "high"
    : risks.some((r) => r.level === "medium")
      ? "medium"
      : "low";
export const strategyLabel = (risk: RiskItem) =>
  risk.closed
    ? "整改已验证"
    : risk.decision
      ? riskStrategyLabels[risk.decision.strategy]
      : "未选策略";

export function selectionState(
  risks: RiskItem[],
  selected: ReadonlySet<number>,
) {
  const ids = risks.filter((r) => r.stage === "research").map((r) => r.id);
  const count = ids.filter((id) => selected.has(id)).length;
  return {
    checked: ids.length > 0 && count === ids.length,
    mixed: count > 0 && count < ids.length,
    disabled: !ids.length,
  };
}
export function toggleRiskSelection(
  selected: ReadonlySet<number>,
  risks: RiskItem[],
  checked: boolean,
) {
  const next = new Set(selected);
  for (const risk of risks)
    if (risk.stage === "research") {
      if (checked) next.add(risk.id);
      else next.delete(risk.id);
    }
  return next;
}

export function categoryGroups(risks: RiskItem[]) {
  const groups = new Map<
    string,
    { key: string; label: string; risks: RiskItem[] }
  >();
  for (const risk of risks) {
    const key = categoryKey(risk);
    if (!groups.has(key))
      groups.set(key, {
        key,
        label: risk.category ? riskCategoryLabels[risk.category] : "规划与实施",
        risks: [],
      });
    groups.get(key)!.risks.push(risk);
  }
  return [...groups.values()];
}

export function ruleGroups(risks: RiskItem[]) {
  const groups = new Map<string, RiskItem[]>();
  for (const risk of risks) {
    // Missing rule identifiers must never merge unrelated findings.
    const key = risk.rule?.trim()
      ? JSON.stringify([
          risk.stage,
          categoryKey(risk),
          risk.rule,
          risk.impact ?? null,
        ])
      : `risk:${risk.id}`;
    groups.set(key, [...(groups.get(key) ?? []), risk]);
  }
  return [...groups].map(([key, items]) => ({ key, risks: items }));
}

export function vmGroups(risks: RiskItem[]) {
  const groups = new Map<string, RiskItem[]>();
  for (const risk of risks) {
    const key = vmKey(risk);
    groups.set(key, [...(groups.get(key) ?? []), risk]);
  }
  return [...groups].map(([key, items]) => ({ key, risks: items }));
}
