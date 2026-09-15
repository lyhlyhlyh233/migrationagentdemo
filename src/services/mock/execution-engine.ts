import { validationReport } from "./validation";
import type { OperationContext } from "@/domain/models";
import type { ExecutionTask } from "@/domain/execution";
import type { MockRuntime } from "./runtime";
import { publishExecution } from "./execution-state";
import { offerHandoff } from "./handoff";
import { raiseIssue } from "./execution-issues";
export function startExecutionLoop(rt: MockRuntime, c: OperationContext) {
  if (rt.executionLoops.has(c.projectId)) return;
  rt.executionLoops.add(c.projectId);
  void (async () => {
    while (!rt.disposed) {
      const s = rt.state(c.projectId);
      const e = s.execution!;
      if (
        !e.tasks.some((t) =>
          ["creating", "full", "incremental", "ready", "cutover"].includes(
            t.phase,
          ),
        )
      )
        break;
      await rt.sleep(1000);
      if (e.connectionStatus !== "ready") break;
      const cap = s.planning?.conditions.concurrency ?? 10;
      const active = e.tasks
        .filter((t) =>
          ["creating", "full", "incremental", "cutover"].includes(t.phase),
        )
        .slice(0, cap);
      const finished: ExecutionTask[] = [];
      for (const t of active) {
        const origin = rt.executionOrigins.get(`${s.id}/${t.id}`) ?? c;
        if (
          !t.scenarioUsed &&
          t.scenario !== "normal" &&
          ["full", "creating"].includes(t.phase)
        ) {
          t.scenarioUsed = true;
          t.resumePhase = t.phase;
          t.phase = "failed";
          t.speed = 0;
          raiseIssue(rt, origin, t);
          if (t.scenario === "permission") break;
          continue;
        }
        if (t.phase === "creating") {
          t.created = true;
          t.phase = "created";
          t.progress = 0;
          t.speed = 0;
          e.revision++;
          finished.push(t);
        } else if (t.phase === "full") {
          t.progress = Math.min(100, t.progress + 25);
          t.syncedGB = (t.totalGB * t.progress) / 100;
          t.speed = Math.round(
            ((s.planning?.conditions.fullBandwidth ?? 10) * 125) /
              Math.max(1, active.length),
          );
          if (t.progress === 100) {
            t.phase = "full-complete";
            t.speed = 0;
            e.revision++;
            finished.push(t);
          }
        } else if (t.phase === "incremental") {
          t.progress = Math.min(100, t.progress + 50);
          if (t.progress === 100) {
            t.phase = "ready";
            t.lastSync = new Date().toISOString();
            t.speed = 0;
            e.revision++;
            finished.push(t);
          }
        } else if (t.phase === "cutover") {
          t.progress = Math.min(100, t.progress + 50);
          if (t.progress === 100) {
            t.phase = "validation";
            t.completedAt = new Date().toISOString();
            t.speed = 0;
            if (!e.validations.some((v) => v.taskId === t.id)) {
              e.revision++;
              const different = e.tasks.indexOf(t) % 5 === 0;
              const asset = s.planning?.assets.find((a) => a.id === t.assetId);
              e.validations.push({
                taskId: t.id,
                technical: different ? "different" : "matched",
                difference: different
                  ? "目标网络与规划映射不一致，请核对是否为预期变更。"
                  : "",
                sourceValue: "源业务网络",
                expectedValue: t.network,
                actualValue: different ? `${t.network}-待核对` : t.network,
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
                business: "pending",
                note: "",
              });
            }
            finished.push(t);
          }
        }
      }
      for (const t of e.tasks.filter((t) => t.phase === "ready"))
        t.lastSync = new Date().toISOString();
      e.trend.push({
        time: new Date().toISOString(),
        speed: active.reduce((n, t) => n + t.speed, 0),
      });
      e.trend = e.trend.slice(-30);
      for (const t of finished) {
        const origin = rt.executionOrigins.get(`${s.id}/${t.id}`) ?? c;
        // Aggregate by origin and completed phase; a batch emits one milestone, not one message per VM.
        const peers = e.tasks.filter(
          (p) =>
            p.batchId === t.batchId &&
            rt.executionOrigins.get(`${s.id}/${p.id}`)?.operationId ===
              origin.operationId,
        );
        const marker = `milestone:${t.batchId}:${t.phase}:${origin.operationId}`;
        if (
          !s.operations[marker] &&
          peers.every((p) =>
            [
              "created",
              "full-complete",
              "ready",
              "validation",
              "failed",
              "paused",
            ].includes(p.phase),
          )
        ) {
          s.operations[marker] = "completed";
          const phase = t.phase as
            "created" | "full-complete" | "ready" | "validation";
          const descriptions = {
            created: [
              `${t.batchId} 任务创建已完成。尚未开始传输，请确认全量同步；异常对象需先处理。`,
              `${t.batchId} tasks have been created. No transfer has started. Confirm full sync to continue; resolve any exceptions first.`,
            ],
            "full-complete": [
              `${t.batchId} 全量同步已完成。任务停留在待增量状态，请单独确认增量同步。`,
              `${t.batchId} full sync is complete. Tasks are waiting for your separate incremental-sync confirmation.`,
            ],
            ready: [
              `${t.batchId} 增量同步已就绪，已授权对象保持持续增量。请核对窗口后人工确认割接；异常或暂停对象仍需处理。`,
              `${t.batchId} incremental sync is ready and authorized tasks continue incremental sync. Review the window and confirm cutover; exceptions and paused tasks still require attention.`,
            ],
            validation: [
              `${t.batchId} 割接结果已更新。请进入结果验证，技术核对与业务确认分别进行；其余批次可以继续实施。`,
              `${t.batchId} cutover results are updated. Continue with technical checks and business validation; other batches may proceed independently.`,
            ],
          };
          const prompts = {
            created: [
              `${t.batchId} 开始全量同步`,
              `Start full sync for ${t.batchId}`,
            ],
            "full-complete": [
              `${t.batchId} 开始增量同步`,
              `Start incremental sync for ${t.batchId}`,
            ],
            ready: [`${t.batchId} 发起割接`, `Start cutover for ${t.batchId}`],
            validation: ["查看结果验证", "View validation results"],
          };
          rt.result(
            origin,
            descriptions[phase][origin.language === "en" ? 1 : 0],
            [
              {
                kind: "execution-work",
                view: t.phase === "validation" ? "validation" : "tasks",
                taskIds: peers.map((p) => p.id),
              },
              {
                kind: "execution-prompt",
                text: prompts[phase][origin.language === "en" ? 1 : 0],
              },
            ],
          );
        }
      }
      if (finished.some((t) => t.phase === "validation"))
        validationReport(rt, s.id);
      offerHandoff(rt, c);
      publishExecution(rt, s);
    }
  })()
    .catch((error) => {
      if (!rt.disposed)
        rt.notice(
          c,
          error instanceof Error ? error.message : "模拟任务已中断，请重试",
        );
    })
    .finally(() => rt.executionLoops.delete(c.projectId));
}
