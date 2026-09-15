import type { ExecutionState, ExecutionTask } from "@/domain/execution";
export const taskStateGroups = [
  { id: "pending", label: "待创建", tone: "muted", phases: ["pending"] },
  { id: "creating", label: "创建中", tone: "info", phases: ["creating"] },
  { id: "created", label: "待全量", tone: "warning", phases: ["created"] },
  {
    id: "full-complete",
    label: "待增量",
    tone: "warning",
    phases: ["full-complete"],
  },
  {
    id: "syncing",
    label: "同步中",
    tone: "info",
    phases: ["full", "incremental"],
  },
  { id: "ready", label: "待割接", tone: "warning", phases: ["ready"] },
  { id: "cutover", label: "割接中", tone: "info", phases: ["cutover"] },
  { id: "done", label: "割接完成", tone: "success", phases: ["validation"] },
  { id: "paused", label: "暂停", tone: "warning", phases: ["paused"] },
  { id: "failed", label: "异常", tone: "danger", phases: ["failed"] },
];
/** Display-only aggregation of recorded execution times, never planned dates or a UI clock. */
export function executionDashboard(e: ExecutionState) {
  const distribution = taskStateGroups.map((g) => ({
    ...g,
    count: e.tasks.filter((t) => g.phases.includes(t.phase)).length,
  }));
  const validTime = (v?: string) =>
    v && Number.isFinite(Date.parse(v)) ? Date.parse(v) : undefined;
  const timestamps = [
    ...e.trend.map((x) => validTime(x.time)),
    ...e.tasks.flatMap((t) => [
      validTime(t.startedAt),
      validTime(t.completedAt),
    ]),
  ].filter((v): v is number => v !== undefined);
  const latest = timestamps.length ? Math.max(...timestamps) : undefined;
  const grouped = new Map<string, ExecutionTask[]>();
  for (const t of e.tasks) {
    const members = grouped.get(t.batchId) ?? [];
    members.push(t);
    grouped.set(t.batchId, members);
  }
  const batches = [...grouped].map(([id, tasks]) => {
    const starts = tasks
      .map((t) => validTime(t.startedAt))
      .filter((v): v is number => v !== undefined);
    const complete = tasks.filter((t) => t.phase === "validation").length;
    const failed = tasks.filter((t) => t.phase === "failed").length,
      paused = tasks.filter((t) => t.phase === "paused").length;
    const done = complete === tasks.length;
    const end = done
      ? Math.max(...tasks.map((t) => validTime(t.completedAt) ?? latest ?? 0))
      : latest;
    return {
      id,
      total: tasks.length,
      started: tasks.filter((t) => t.created || !!t.startedAt).length,
      created: tasks.filter((t) => t.created).length,
      complete,
      failed,
      paused,
      start: starts.length ? Math.min(...starts) : undefined,
      end,
      tone: failed ? "danger" : paused ? "warning" : done ? "success" : "info",
      label: failed
        ? "异常"
        : paused
          ? "暂停"
          : done
            ? "割接完成"
            : tasks.every((task) => task.phase === "created")
              ? "待全量"
              : tasks.every((task) => task.phase === "full-complete")
                ? "待增量"
                : tasks.every((task) => task.phase === "ready")
                  ? "待割接"
                  : starts.length
                    ? "运行中"
                    : "待执行",
    };
  });
  const starts = batches.flatMap((b) =>
    b.start === undefined ? [] : [b.start],
  );
  return {
    distribution,
    batches,
    latest,
    start: starts.length ? Math.min(...starts) : undefined,
  };
}
