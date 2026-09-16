import type { BusinessValidation, ExecutionTask } from "@/domain/execution";
import type { OperationContext, ProjectSnapshot } from "@/domain/models";
import type { MockRuntime } from "./runtime";

function sampleValidation(
  s: ProjectSnapshot,
  task: ExecutionTask,
  passed: boolean,
): BusinessValidation {
  const asset = s.planning?.assets.find((a) => a.id === task.assetId);
  return {
    taskId: task.id,
    technical: "matched",
    difference: "",
    sourceValue: "源业务网络",
    expectedValue: task.network,
    actualValue: task.network,
    configuration: [
      { field: "GuestOS", value: asset?.os ?? "" },
      { field: "vCPU", value: String(asset?.cpu ?? 0) },
      { field: "内存", value: `${asset?.memory ?? 0} GB` },
      { field: "磁盘容量", value: `${asset?.storage ?? 0} GB` },
    ].map(({ field, value }) => ({
      field,
      source: value,
      expected: value,
      actual: value,
    })),
    business: passed ? "passed" : "pending",
    note: passed ? "示例业务验证通过" : "",
    ...(passed
      ? { confirmedBy: "示例用户", confirmedAt: task.completedAt }
      : {}),
  };
}

/** A fixed walkthrough snapshot. No timers or automatic diagnoses are started. */
export function seedDemoExecution(
  rt: MockRuntime,
  s: ProjectSnapshot,
  c: OperationContext,
) {
  const e = s.execution;
  if (
    !s.demoMode ||
    !e ||
    e.sampleProgress ||
    e.tasks.some((t) => t.created || t.phase !== "pending")
  )
    return;
  e.sampleProgress = true;
  const batches = s.planning?.batches ?? [];
  e.recommendedBatchId = batches[3]?.id ?? batches[0]?.id;
  const now = Date.now();
  const at = (hours: number) => new Date(now - hours * 3600000).toISOString();
  batches.forEach((batch, index) => {
    e.tasks
      .filter((t) => t.batchId === batch.id)
      .forEach((task, position) => {
        task.demoFrozen = true;
        if (index > 4) return;
        task.created = true;
        task.startedAt = at((5 - index) * 12);
        if (index < 2) {
          task.phase = "validation";
          task.progress = 100;
          task.syncedGB = task.totalGB;
          task.lastSync = at((4 - index) * 12 + 1);
          task.completedAt = at((4 - index) * 12);
          e.validations.push(sampleValidation(s, task, index === 0));
        } else if (index === 2) {
          task.phase = "ready";
          task.progress = 100;
          task.syncedGB = task.totalGB;
          task.lastSync = at(0.05);
        } else if (index === 3) {
          task.phase =
            position === 0 ? "paused" : position === 1 ? "failed" : "full";
          task.resumePhase = "full";
          task.progress = 46 + (position % 7) * 5;
          task.syncedGB = Math.round((task.totalGB * task.progress) / 100);
          task.speed = task.phase === "full" ? 32 + (position % 8) : 0;
          if (task.phase === "failed") {
            task.scenario = "network";
            task.scenarioUsed = true;
            const id = `sample-network-${task.id}`;
            const logId = `execution-log:${id}`;
            e.issues.push({
              id,
              taskIds: [task.id],
              category: "network",
              title: "同步网络异常",
              state: "ready",
              origin: { ...c },
              evidence: `模拟日志：${task.name} 同步通道多次超时。`,
              diagnosis:
                "示例诊断：同步通道不稳定。建议重新建立通道，保留已同步数据；也可人工检查网络后复查。",
              logId,
              note: "",
              attachments: [],
              createdAt: at(0.25),
              updatedAt: at(0.2),
            });
            rt.files.set(`${s.id}/${logId}`, {
              filename: `${batch.id}-sample-network.log`,
              mediaType: "text/plain;charset=utf-8",
              body: `MOCK LOG / 示例日志\nVM: ${task.name}\nSYNC_CHANNEL_TIMEOUT\nNo remote service was contacted.`,
            });
          }
        } else task.phase = "created";
      });
  });
  e.trend = Array.from({ length: 12 }, (_, index) => ({
    time: at((11 - index) / 60),
    speed: 540 + (index % 5) * 42,
  }));
  e.revision++;
}

/** Missing validation examples may be added without rewriting existing execution history. */
export function seedMissingDemoValidation(s: ProjectSnapshot) {
  const e = s.execution;
  if (!s.demoMode || !e || e.validations.length) return false;
  const task =
    e.tasks.find((t) => t.phase === "validation") ??
    e.tasks.find((t) => t.phase === "pending");
  if (!task) return false;
  task.created = true;
  task.phase = "validation";
  task.progress = 100;
  task.syncedGB = task.totalGB;
  task.startedAt ??= new Date(Date.now() - 3600000).toISOString();
  task.completedAt ??= new Date().toISOString();
  task.demoFrozen = true;
  e.validations.push(sampleValidation(s, task, false));
  e.revision++;
  return true;
}
