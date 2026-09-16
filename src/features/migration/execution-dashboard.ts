import type { ExecutionState, ExecutionTask } from "@/domain/execution";

export const batchProgressGroups: {
  id: string;
  label: string;
  tone: string;
  phases: ExecutionTask["phase"][];
}[] = [
  {
    id: "waiting",
    label: "待执行",
    tone: "muted",
    phases: ["pending", "created", "full-complete", "ready"],
  },
  {
    id: "active",
    label: "执行中",
    tone: "info",
    phases: ["creating", "full", "incremental", "cutover"],
  },
  {
    id: "complete",
    label: "割接完成",
    tone: "success",
    phases: ["validation"],
  },
  { id: "paused", label: "暂停", tone: "warning", phases: ["paused"] },
  { id: "failed", label: "异常", tone: "danger", phases: ["failed"] },
];

/** Current execution stage, kept separate from a task's running/waiting status. */
export function taskExecutionStage(task: ExecutionTask) {
  const phase =
    task.phase === "paused" || task.phase === "failed"
      ? task.resumePhase
      : task.phase;
  switch (phase) {
    case "pending":
    case "creating":
    case "created":
      return "创建任务";
    case "full":
    case "full-complete":
      return "全量同步";
    case "incremental":
    case "ready":
      return "增量同步";
    case "cutover":
      return "割接";
    case "validation":
      return "结果验证";
    default:
      return "阶段待确认";
  }
}

export function taskExecutionStatus(task: ExecutionTask) {
  const labels: Record<ExecutionTask["phase"], string> = {
    pending: "待创建",
    creating: "进行中",
    created: "已完成",
    full: "同步中",
    "full-complete": "已完成",
    incremental: "同步中",
    ready: "已就绪",
    cutover: "进行中",
    validation: "待验证",
    paused: "已暂停",
    failed: "异常",
  };
  return labels[task.phase];
}

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
      segments: batchProgressGroups.map(({ id, label, tone, phases }) => ({
        id,
        label,
        tone,
        count: tasks.filter((task) => phases.includes(task.phase)).length,
      })),
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
