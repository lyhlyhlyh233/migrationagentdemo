import type { OperationContext, ProjectSnapshot } from "@/domain/models";
import type { ExecutionState } from "@/domain/execution";
import { eligiblePlanningAssets } from "@/domain/planning";
import { buildValidationTasks } from "./fixtures";
import type { MockRuntime } from "./runtime";
import { requireCondition } from "../errors";
export function initializeExecution(s: ProjectSnapshot): ExecutionState {
  if (s.execution) return s.execution;
  requireCondition(
    s.planning?.batches.length && s.enteredStages.includes("migration"),
    "请先确认规划交接",
  );
  const assets = new Map(eligiblePlanningAssets(s).map((a) => [a.id, a]));
  s.execution = {
    revision: 0,
    connectionStatus: "unconfigured",
    issues: [],
    validations: [],
    feedback: [],
    trend: [],
    finalized: false,
    tasks: s.planning.batches.flatMap((b) =>
      b.assetIds.flatMap((id) => {
        const a = assets.get(id);
        if (!a) return [];
        return [
          {
            id: `EX-${a.id}`,
            assetId: id,
            name: a.name,
            system: a.system,
            batchId: b.id,
            phase: "pending" as const,
            created: false,
            progress: 0,
            syncedGB: 0,
            totalGB: a.storage,
            speed: 0,
            window: b.window,
            computeResource: "目标资源池",
            network: "目标业务网络",
            scenario: "normal" as const,
            scenarioUsed: false,
          },
        ];
      }),
    ),
  };
  projectExecution(s);
  return s.execution;
}
// Compatibility views are derived from the execution snapshot, never independently executed.
export function projectExecution(s: ProjectSnapshot) {
  const e = s.execution;
  if (!e) return;
  const assets = new Map(s.planning?.assets.map((a) => [a.id, a]));
  s.batchTasks = s.batchTasks.map((b) => ({
    ...b,
    vmNames: e.tasks.filter((t) => t.batchId === b.id).map((t) => t.name),
  }));
  s.vmTasks = e.tasks.map((t, index) => ({
    id: t.id,
    batchId: t.batchId,
    name: t.name,
    os: assets.get(t.assetId)?.os ?? "",
    riskIds: s.risks.filter((r) => r.vmId === t.assetId).map((r) => r.id),
    targetIp: `10.88.${Math.floor(index / 250)}.${(index % 250) + 1}`,
    status:
      t.phase === "validation"
        ? "succeeded"
        : t.phase === "paused" || t.phase === "failed"
          ? "paused"
          : t.phase === "pending"
            ? "pending-sync"
            : "syncing",
    checkStatus: t.phase === "validation" ? "passed" : "pending-check",
    progress: t.progress,
    migrated: `${Math.round(t.syncedGB)} / ${t.totalGB} GB`,
    speed: `${t.speed} MB/s`,
    startTime: t.startedAt ?? "",
    endTime: t.completedAt ?? "",
    duration: "",
    remaining: "",
    migrationMethod: assets.get(t.assetId)?.method,
  }));
  s.creationTasks = e.tasks.map((t) => {
    const a = assets.get(t.assetId);
    return {
      id: `CT-${t.assetId}`,
      sourceTaskId: t.id,
      vmName: t.name,
      hostName: "示例源端",
      powerState: "powered-on",
      os: a?.os ?? "",
      firmware: "UEFI",
      cpu: a?.cpu ?? 0,
      memory: `${a?.memory ?? 0} GB`,
      disk: `${a?.storage ?? 0} GB`,
      vmtools: "running",
      check: "passed",
      taskName: t.name,
      computeResource: t.computeResource,
      portGroup: t.network,
      status: t.created ? "created" : "unconfigured",
    };
  });
  const existing = new Map(s.validationTasks.map((v) => [v.sourceTaskId, v]));
  s.validationTasks = e.validations.map((v) => {
    const t = s.vmTasks.find((t) => t.id === v.taskId)!;
    const record =
      existing.get(t.id) ?? buildValidationTasks([t], s.batchTasks)[0];
    return {
      ...record,
      comparison: v.technical === "different" ? "different" : "matched",
      confirmed: v.business === "passed",
    };
  });
  const count = e.tasks.length;
  for (const kind of ["creation", "sync", "cutover"] as const) {
    const completed = e.tasks.filter((t) =>
      kind === "creation"
        ? t.created
        : kind === "sync"
          ? ["ready", "cutover", "validation"].includes(t.phase)
          : t.phase === "validation",
    ).length;
    const running = e.tasks.filter((t) =>
      kind === "creation"
        ? t.phase === "creating"
        : kind === "sync"
          ? ["full", "incremental"].includes(t.phase)
          : t.phase === "cutover",
    ).length;
    s.executionMetrics[kind] = {
      total: count,
      completed,
      running,
      queued: count - completed - running,
    };
    s.executionApprovals[kind] = e.tasks.some((t) => t.created);
  }
  s.mdStatus =
    e.connectionStatus === "ready"
      ? "ready"
      : e.connectionStatus === "checking"
        ? "checking-connection"
        : "unconfigured";
}
export function publishExecution(rt: MockRuntime, s: ProjectSnapshot) {
  projectExecution(s);
  rt.publish(s);
}
export function executionIntro(rt: MockRuntime, c: OperationContext) {
  const s = rt.context(c);
  const e = initializeExecution(s);
  rt.message(c, "user", "开始迁移项目的实施准备", { operation: true });
  void rt
    .run(c, "intro:" + c.stageId, async (s, options, runId) => {
      s.pending[c.conversationId] = { startedAt: Date.now(), runId };
      rt.publish(s);
      await rt.sleep(1200, options);
      rt.result(
        c,
        `规划已交接，共 ${e.tasks.length} 台虚拟机。请先检测 Migration 连接，再选择批次启动。\n\n启动后自动完成全量并保持增量同步；割接前我会展示范围与检查结果，由你确认。连接与执行均为前端模拟。`,
        [{ kind: "execution-work", view: "connection" }],
      );
      delete s.pending[c.conversationId];
    })
    .catch((error) => {
      if (!rt.disposed && error?.code !== "STOPPED")
        rt.notice(c, error instanceof Error ? error.message : String(error));
    });
}
