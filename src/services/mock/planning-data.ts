import { migrationMethod, migrationScope } from "@/domain/assessment";
import type { ProjectSnapshot } from "@/domain/models";
import {
  planningRiskSignature,
  type PlanningAsset,
  type PlanningState,
} from "@/domain/planning";
import { riskStrategyLabels } from "@/shared/i18n/risks";

export function planningAssets(s: ProjectSnapshot): PlanningAsset[] {
  const previous = new Map(s.planning?.assets.map((a) => [a.name, a]));
  const risks = new Map<string, typeof s.risks>();
  s.risks
    .filter((r) => r.stage === "research")
    .forEach((r) => risks.set(r.vmName, [...(risks.get(r.vmName) ?? []), r]));
  return s.scopeRows.map((row, index) => {
    const name = String(row[0]);
    const found = risks.get(name) ?? [];
    const old = previous.get(name);
    return {
      id: old?.id ?? `${s.id}:vm:${index + 1}`,
      name,
      cpu: Number(row[2]) || 4,
      memory: Number(row[3]) || 16,
      disks: 2,
      storage: 120 + (index % 5) * 80,
      os: index % 4 ? "Ubuntu 22.04" : "Windows Server 2019",
      system: old?.system ?? "",
      grade: old?.grade ?? "",
      clusterType: old?.clusterType ?? "",
      clusterRole: old?.clusterRole ?? "",
      method: migrationMethod(s, name),
      strategy:
        [
          ...new Set(
            found.map((r) =>
              r.decision ? riskStrategyLabels[r.decision.strategy] : "未选策略",
            ),
          ),
        ].join("；") || "按评估迁移",
      riskScore: found.reduce(
        (sum, r) =>
          sum + (r.level === "high" ? 30 : r.level === "medium" ? 15 : 5),
        0,
      ),
      riskLevel: found.some((r) => r.level === "high")
        ? "high"
        : found.some((r) => r.level === "medium")
          ? "medium"
          : found.length
            ? "low"
            : "none",
    };
  });
}
export function initializePlanning(s: ProjectSnapshot): PlanningState {
  if (s.planning) return s.planning;
  const assets = planningAssets(s);
  const eligible = new Set(migrationScope(s).map((r) => String(r[0])));
  s.planning = {
    revision: 0,
    assets,
    baselineEligibleIds: assets
      .filter((a) => eligible.has(a.name))
      .map((a) => a.id),
    conditions: {
      fullBandwidth: 10,
      incrementalBandwidth: 2,
      downtime: 4,
      cutoverWindow: "周六 00:00–06:00",
      freeze: "",
      startDate: "2026-09-20",
      validationHours: 1,
      concurrency: 20,
    },
    conditionsSource: "sample",
    capacity: { cpu: 1600, memory: 6400, storage: 120000, reserve: 20 },
    dependencies: [],
    batches: [],
    stale: false,
    riskSignature: planningRiskSignature(s),
  };
  return s.planning;
}
export function isoAfter(value: string, days: number) {
  return new Date(
    Date.parse(
      value.length === 10
        ? `${value}T00:00:00Z`
        : value.endsWith("Z")
          ? value
          : `${value}Z`,
    ) +
      days * 86400000,
  )
    .toISOString()
    .slice(0, 16);
}
