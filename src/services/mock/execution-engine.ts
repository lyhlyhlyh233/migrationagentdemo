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
          t.phase = "full";
          t.progress = 0;
        } else if (t.phase === "full") {
          t.progress = Math.min(100, t.progress + 25);
          t.syncedGB = (t.totalGB * t.progress) / 100;
          t.speed = Math.round(
            ((s.planning?.conditions.fullBandwidth ?? 10) * 125) /
              Math.max(1, active.length),
          );
          if (t.progress === 100) {
            t.phase = "incremental";
            t.progress = 0;
          }
        } else if (t.phase === "incremental") {
          t.progress = Math.min(100, t.progress + 50);
          if (t.progress === 100) {
            t.phase = "ready";
            t.lastSync = new Date().toISOString();
            t.speed = 0;
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
            p.sourceConversationId === t.sourceConversationId,
        );
        const marker = `milestone:${t.batchId}:${t.phase}:${origin.operationId}`;
        if (
          !s.operations[marker] &&
          peers.every((p) =>
            ["ready", "validation", "failed", "paused"].includes(p.phase),
          )
        ) {
          s.operations[marker] = "completed";
          rt.result(
            origin,
            t.phase === "validation"
              ? "本批次割接结果已更新。请进入结果验证，技术核对与业务确认分别进行。其余批次可以继续实施。"
              : peers.every((p) => ["ready", "validation"].includes(p.phase))
                ? "本批次全量与增量同步已完成，就绪对象保持增量同步。请核对窗口后人工确认割接，异常对象需先处理。"
                : "本批次同步结果已更新。就绪对象保持增量同步；暂停或异常对象仍需处理，割接必须人工确认。",
            [
              {
                kind: "execution-work",
                view: t.phase === "validation" ? "validation" : "tasks",
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
