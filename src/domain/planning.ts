import type { ProjectSnapshot, MigrationMethod } from "./models";
import { migrationScope } from "./assessment";

export interface BusinessAttributes {
  system: string;
  grade: "" | "general" | "important" | "critical";
  clusterType: string;
  clusterRole: string;
}
export interface PlanningAsset extends BusinessAttributes {
  id: string;
  name: string;
  cpu: number;
  memory: number;
  disks: number;
  storage: number;
  os: string;
  method: MigrationMethod;
  strategy: string;
  riskScore: number;
  riskLevel: "none" | "low" | "medium" | "high";
}
export interface PlanningDependency {
  id: string;
  upstream: string;
  downstream: string;
  strength: "strong" | "weak";
  note: string;
}
export interface PlanningConditions {
  fullBandwidth: number;
  incrementalBandwidth: number;
  downtime: number;
  cutoverWindow: string;
  freeze: string;
  startDate: string;
  validationHours: number;
  concurrency: number;
}
export interface PlanningCapacity {
  cpu: number;
  memory: number;
  storage: number;
  reserve: number;
}
export interface PlanningBatch {
  id: string;
  phase: "pilot" | "core" | "scale";
  assetIds: string[];
  start: string;
  cutover: string;
  end: string;
  downtime: number;
  bufferDays: number;
  window: string;
}
export type PlanningAdjustment =
  | { kind: "window"; batchIds: string[]; cutover: string; bufferDays: number }
  | { kind: "move"; assetIds: string[]; targetBatchId: string }
  | { kind: "conditions"; values: Partial<PlanningConditions> }
  | { kind: "import"; filename: string };
export interface PlanningPreview {
  id: string;
  conversationId: string;
  baseRevision: number;
  change: PlanningAdjustment;
  rows: { label: string; before: string; after: string }[];
}
export interface PlanningState {
  revision: number;
  assets: PlanningAsset[];
  baselineEligibleIds: string[];
  conditions: PlanningConditions;
  conditionsSource: "sample" | "user";
  capacity: PlanningCapacity;
  dependencies: PlanningDependency[];
  batches: PlanningBatch[];
  stale: boolean;
  riskSignature: string;
  preview?: PlanningPreview;
}
export interface PlanningInputPatch {
  conditions?: PlanningConditions;
  capacity?: PlanningCapacity;
  dependencies?: PlanningDependency[];
  attributes?: { assetIds: string[]; values: Partial<BusinessAttributes> };
}
// Sample schedule values are wall-clock timestamps without a timezone.
// Interpret consistently in UTC for arithmetic; display the stored calendar value.
export function planningTime(value: string) {
  return Date.parse(value.endsWith("Z") ? value : `${value}Z`);
}
export function planningRiskSignature(s: ProjectSnapshot) {
  return JSON.stringify(
    s.risks
      .filter((r) => r.stage === "research")
      .map((r) => [r.id, r.closed, r.decision]),
  );
}
export function planningIsStale(s: ProjectSnapshot) {
  return (
    !!s.planning?.batches.length &&
    (s.planning.stale || s.planning.riskSignature !== planningRiskSignature(s))
  );
}
export function eligiblePlanningAssets(s: ProjectSnapshot) {
  const names = new Set(migrationScope(s).map((r) => String(r[0])));
  return s.planning?.assets.filter((a) => names.has(a.name)) ?? [];
}
export function resourceTotals(assets: PlanningAsset[]) {
  return assets.reduce(
    (sum, a) => ({
      cpu: sum.cpu + a.cpu,
      memory: sum.memory + a.memory,
      storage: sum.storage + a.storage,
    }),
    { cpu: 0, memory: 0, storage: 0 },
  );
}
export function planningSummary(p: PlanningState) {
  const assetMap = new Map(p.assets.map((a) => [a.id, a]));
  const ids = new Set(p.batches.flatMap((b) => b.assetIds));
  const assets = [...ids].flatMap((id) => assetMap.get(id) ?? []);
  const starts = p.batches.map((b) => planningTime(b.start));
  const ends = p.batches.map((b) => planningTime(b.end));
  return {
    included: ids.size,
    excluded: p.assets.length - ids.size,
    downtime:
      Math.round(p.batches.reduce((n, b) => n + b.downtime, 0) * 10) / 10,
    days: starts.length
      ? Math.max(
          1,
          Math.ceil((Math.max(...ends) - Math.min(...starts)) / 86400000),
        )
      : 0,
    resources: resourceTotals(assets),
    missing: assets.filter((a) => !a.system || !a.grade).length,
  };
}
// Advisory checks for an authored simulation, not a production scheduling solver.
export function planningWarnings(p: PlanningState): string[] {
  const summary = planningSummary(p);
  const warnings = new Set<string>();
  if (p.assets.some((a) => !a.system || !a.grade) || !p.dependencies.length)
    warnings.add("业务依赖待核对");
  if (p.assets.some((a) => a.clusterType))
    warnings.add("集群拓扑与角色顺序需人工核对");
  const graph = new Map<string, string[]>();
  for (const d of p.dependencies)
    graph.set(d.upstream, [...(graph.get(d.upstream) ?? []), d.downstream]);
  // Kahn traversal avoids recursion for large imported dependency lists.
  const incoming = new Map<string, number>();
  for (const [node, children] of graph) {
    if (!incoming.has(node)) incoming.set(node, 0);
    for (const child of children)
      incoming.set(child, (incoming.get(child) ?? 0) + 1);
  }
  const ready = [...incoming.keys()].filter((node) => incoming.get(node) === 0);
  for (let i = 0; i < ready.length; i++)
    for (const child of graph.get(ready[i]) ?? []) {
      const count = incoming.get(child)! - 1;
      incoming.set(child, count);
      if (count === 0) ready.push(child);
    }
  if (ready.length < incoming.size)
    warnings.add("存在循环依赖，请核对联合割接范围");
  const systems = new Set(p.assets.map((a) => a.system).filter(Boolean));
  if (
    p.dependencies.some(
      (d) => !systems.has(d.upstream) || !systems.has(d.downstream),
    )
  )
    warnings.add("依赖关系存在未关联业务系统");
  if (p.dependencies.some((d) => d.strength === "weak"))
    warnings.add("弱依赖需核对先后顺序");
  const byId = new Map(p.assets.map((a) => [a.id, a]));
  const businessBatches = new Map<string, Set<string>>();
  p.batches.forEach((b) =>
    b.assetIds.forEach((id) => {
      const system = byId.get(id)?.system;
      if (system)
        businessBatches.set(
          system,
          new Set([...(businessBatches.get(system) ?? []), b.id]),
        );
    }),
  );
  if (
    p.dependencies.some(
      (d) =>
        d.strength === "strong" &&
        new Set([
          ...(businessBatches.get(d.upstream) ?? []),
          ...(businessBatches.get(d.downstream) ?? []),
        ]).size > 1,
    )
  )
    warnings.add("强依赖系统跨批次，请核对共同割接安排");
  if (p.conditions.freeze)
    warnings.add("已填写封网期，请人工核对示例日期是否避开");
  if (
    p.batches.some(
      (b) => b.downtime + p.conditions.validationHours > p.conditions.downtime,
    )
  )
    warnings.add("部分批次停机与验证时长超过允许窗口");
  if (p.conditions.fullBandwidth < 5 || p.conditions.incrementalBandwidth < 1)
    warnings.add("同步带宽较低，需重新估算同步时长");
  if (p.batches.some((b) => b.assetIds.length > p.conditions.concurrency))
    warnings.add("批次内需分组并发，示例时间未进行精确排程");
  if (
    (["cpu", "memory", "storage"] as const).some(
      (k) =>
        summary.resources[k] > p.capacity[k] * (1 - p.capacity.reserve / 100),
    )
  )
    warnings.add("目标可用资源不足，请扩容或调整范围");
  return [...warnings];
}
