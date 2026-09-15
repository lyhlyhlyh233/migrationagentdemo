import type { OperationContext, ProjectSnapshot } from "./models";
export type ExecutionPhase =
  | "pending"
  | "creating"
  | "created"
  | "full"
  | "full-complete"
  | "incremental"
  | "ready"
  | "cutover"
  | "validation"
  | "paused"
  | "failed";
export type ExecutionAction =
  | "start"
  | "full"
  | "increment"
  | "cutover"
  | "pause"
  | "resume"
  | "retry"
  | "move"
  | "window";
export type SimulationScenario =
  "normal" | "network" | "capacity" | "permission";
export interface MigrationConnectionInput {
  ip: string;
  port: number;
  username: string;
  password: string;
}
export interface ExecutionTask {
  id: string;
  assetId: string;
  name: string;
  system: string;
  batchId: string;
  phase: ExecutionPhase;
  resumePhase?: ExecutionPhase;
  created: boolean;
  progress: number;
  speed: number;
  syncedGB: number;
  totalGB: number;
  lastSync?: string;
  window: string;
  computeResource: string;
  network: string;
  startedAt?: string;
  completedAt?: string;
  sourceConversationId?: string;
  scenario: SimulationScenario;
  scenarioUsed: boolean;
}
export interface ExecutionPreview {
  id: string;
  revision: number;
  origin: OperationContext;
  action: ExecutionAction;
  taskIds: string[];
  targetBatchId?: string;
  window?: string;
  computeResource?: string;
  network?: string;
  scenario?: SimulationScenario;
  rows: { label: string; before: string; after: string }[];
}
export interface ExecutionIssue {
  id: string;
  taskIds: string[];
  category: SimulationScenario | "feedback";
  title: string;
  state:
    | "collecting"
    | "diagnosing"
    | "ready"
    | "log-failed"
    | "inconclusive"
    | "manual"
    | "repairing"
    | "repair-failed"
    | "resolved";
  origin: OperationContext;
  evidence: string;
  diagnosis: string;
  logId?: string;
  solution?: "automatic" | "manual";
  note: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}
export interface BusinessValidation {
  taskId: string;
  technical: "matched" | "different" | "accepted";
  difference: string;
  sourceValue: string;
  expectedValue: string;
  actualValue: string;
  acceptanceNote?: string;
  configuration: {
    field: string;
    source: string;
    expected: string;
    actual: string;
  }[];
  business: "pending" | "passed" | "failed";
  note: string;
  confirmedBy?: string;
  confirmedAt?: string;
}
export interface MigrationFeedback {
  id: string;
  taskIds: string[];
  batchId?: string;
  description: string;
  blocking: boolean;
  status: "open" | "review" | "resolved";
  resolution: string;
  attachments: string[];
  origin: OperationContext;
}
export interface ExecutionState {
  revision: number;
  connection?: {
    ip: string;
    port: number;
    username: string;
    checkedAt: string;
  };
  connectionStatus: "unconfigured" | "checking" | "ready" | "failed";
  connectionError?: string;
  tasks: ExecutionTask[];
  issues: ExecutionIssue[];
  validations: BusinessValidation[];
  feedback: MigrationFeedback[];
  preview?: ExecutionPreview;
  trend: { time: string; speed: number }[];
  finalized: boolean;
}
export const phaseLabels: Record<ExecutionPhase, string> = {
  pending: "待创建",
  creating: "创建中",
  created: "待全量同步",
  full: "全量同步",
  "full-complete": "待增量同步",
  incremental: "增量同步",
  ready: "可割接",
  cutover: "割接中",
  validation: "割接完成",
  paused: "已暂停",
  failed: "异常",
};
export const actionLabels: Record<ExecutionAction, string> = {
  start: "创建任务",
  full: "开始全量同步",
  increment: "开始增量同步",
  cutover: "发起割接",
  pause: "暂停同步",
  resume: "恢复同步",
  retry: "重试任务",
  move: "调整批次",
  window: "调整窗口",
};
export function executionSummary(e?: ExecutionState) {
  const tasks = e?.tasks ?? [];
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.phase === "pending").length,
    creating: tasks.filter((t) => t.phase === "creating").length,
    waitingFull: tasks.filter((t) => t.phase === "created").length,
    waitingIncrement: tasks.filter((t) => t.phase === "full-complete").length,
    syncing: tasks.filter((t) =>
      ["full", "incremental", "ready"].includes(t.phase),
    ).length,
    cutover: tasks.filter((t) => t.phase === "validation").length,
    failed: tasks.filter((t) => t.phase === "failed").length,
    passed: e?.validations.filter((v) => v.business === "passed").length ?? 0,
  };
}
export function hasActiveControl(e: ExecutionState) {
  return (
    e.tasks.some((t) =>
      ["creating", "full", "incremental", "cutover"].includes(t.phase),
    ) || e.issues.some((i) => i.state === "repairing")
  );
}
export function unresolvedTaskIssue(e: ExecutionState, id: string) {
  return (
    e.issues.some((i) => i.taskIds.includes(id) && i.state !== "resolved") ||
    e.feedback.some(
      (f) => f.blocking && f.status !== "resolved" && f.taskIds.includes(id),
    )
  );
}
export function executionBlock(
  s: ProjectSnapshot,
  task: ExecutionTask,
  action: ExecutionAction,
): string | undefined {
  const e = s.execution;
  if (!e || !s.enteredStages.includes("migration"))
    return "请先确认进入迁移实施";
  if (e.finalized) return "项目已确认最终交付";
  if (action === "move")
    return task.phase === "pending" && !task.created
      ? undefined
      : "只能移动尚未创建任务的虚拟机";
  if (action === "window")
    return ["cutover", "validation"].includes(task.phase)
      ? "割接已开始，不能修改窗口"
      : undefined;
  if (action === "pause")
    return ["full", "incremental", "ready"].includes(task.phase)
      ? undefined
      : "仅同步中的任务可暂停";
  if (e.connectionStatus !== "ready") return "请先检测 Migration 连接";
  if (action === "start")
    return task.phase === "pending" && !task.created
      ? undefined
      : "任务已经创建或正在创建";
  if (unresolvedTaskIssue(e, task.id)) return "请先完成问题处理与复查";
  if (action === "full")
    return task.phase === "created" && task.created
      ? undefined
      : "请先完成任务创建；全量同步须单独确认";
  if (action === "cutover") {
    if (task.phase !== "ready" || !task.lastSync)
      return "请先完成全量与增量同步";
    const upstreamSystems =
      s.planning?.dependencies
        .filter((d) => d.strength === "strong" && d.downstream === task.system)
        .map((d) => d.upstream) ?? [];
    if (
      e.tasks.some(
        (t) =>
          upstreamSystems.includes(t.system) && unresolvedTaskIssue(e, t.id),
      )
    )
      return "关联业务存在阻塞问题";
    return undefined;
  }
  if (action === "increment")
    return ["full-complete", "ready"].includes(task.phase)
      ? undefined
      : "请先完成全量同步；增量同步须单独确认";
  if (action === "resume")
    return task.phase !== "paused"
      ? "任务未暂停"
      : canResumePhase(task.resumePhase)
        ? undefined
        : "没有可恢复的已确认操作，请重新选择阶段操作";
  if (action === "retry")
    return task.phase !== "failed"
      ? "任务未失败"
      : canResumePhase(task.resumePhase)
        ? undefined
        : "没有可重试的已确认操作，请重新选择阶段操作";
}
/** Resume only the recorded interrupted operation; waiting states never imply consent. */
export function canResumePhase(phase?: ExecutionPhase) {
  return (
    !!phase &&
    ["creating", "full", "incremental", "ready", "cutover"].includes(phase)
  );
}
export function canValidate(e: ExecutionState, v: BusinessValidation) {
  return v.technical !== "different" && !unresolvedTaskIssue(e, v.taskId);
}
