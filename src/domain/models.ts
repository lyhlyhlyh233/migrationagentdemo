import type { ExecutionState } from "./execution";
import type { PlanningState } from "./planning";
export interface ReplyPresentation {
  summary: string;
  durationMs: number;
}
export type ConversationAgentId = string;
export type ConversationModelId = string;
export type StageId = "research" | "planning" | "migration" | "validation";
// Reserved UI workspace for conversations before a project is created.
export const EMPTY_WORKSPACE_ID = "lobby";
export interface StageConversation {
  id: string;
  stageId: StageId;
  title: string;
  kind: "main" | "child";
  manuallyNamed?: boolean;
}

export type AssessmentStatus = "idle" | "ready" | "running" | "completed";
export type PlanningStatus =
  "locked" | "scope-review" | "details-pending" | "generating" | "completed";
export type BatchConfirmationStatus = "pending" | "adjusting" | "confirmed";
export type MdStatus =
  | "unconfigured"
  | "checking-connection"
  | "connected"
  | "checking-config"
  | "ready";
export type ExecutionTaskKind = "creation" | "cutover" | "sync";

export interface ProjectInfo {
  industry: string;
  region: string;
  office: string;
  siteName: string;
  migrationType: string;
}

export type RiskCategory =
  | "compatibility"
  | "disk"
  | "specification"
  | "application"
  | "capacity"
  | "hardware"
  | "feature";
export type RiskImpact = "constraint" | "change" | "blocked";
export type RiskStrategy = "ignore" | "remediate" | "exclude" | "custom";
export type MigrationMethod = "agentless" | "agent" | "manual";
export interface RiskDecision {
  strategy: RiskStrategy;
  method: MigrationMethod;
  note: string;
  selectedAt: string;
}
export interface AssessmentPlan {
  mode: "hybrid" | "agentless" | "custom";
  note: string;
}
export interface RiskItem {
  id: number;
  description: string;
  level: "high" | "medium" | "low";
  stage: StageId;
  batchId: string;
  vmName: string;
  vmId: string;
  closed: boolean;
  closedAt: string;
  closureDescription: string;
  category?: RiskCategory;
  impact?: RiskImpact;
  rule?: string;
  evidence?: string;
  recommendation?: string;
  recommendedStrategy?: RiskStrategy;
  recommendedMethod?: MigrationMethod;
  decision?: RiskDecision;
}

export interface ChatMessage {
  id: number;
  role: "agent" | "user" | "system";
  text: string;
  time: string;
  conversationId: string;
  stageId?: StageId;
  operation?: boolean;
  activity?: "assessment-preparation";
  operationId?: string;
  modelId?: ConversationModelId;
  agentId?: ConversationAgentId;
  reply?: ReplyPresentation;
  results?: BusinessResult[];
  requestId?: string;
}

export interface BatchTask {
  id: string;
  batchPhase: "pilot" | "core" | "scale";
  vmNames: string[];
  stageType: "full-sync" | "incremental-sync" | "cutover" | "verify";
  startDate: string;
  endDate: string;
  durationDays: number;
}

export interface VmTask {
  migrationMethod?: MigrationMethod;
  id: string;
  batchId: string;
  os: string;
  riskIds: number[];
  name: string;
  targetIp: string;
  status: "pending-sync" | "syncing" | "succeeded" | "paused";
  checkStatus: "pending-check" | "checking" | "passed";
  progress: number;
  migrated: string;
  speed: string;
  startTime: string;
  endTime: string;
  duration: string;
  remaining: string;
}

export interface CreationTask {
  migrationMethod?: MigrationMethod;
  sourceTaskId: string;
  id: string;
  hostName: string;
  vmName: string;
  powerState: "powered-on" | "powered-off";
  os: string;
  firmware: "BIOS" | "UEFI";
  cpu: number;
  memory: string;
  disk: string;
  vmtools: string;
  check: "passed";
  taskName: string;
  computeResource?: string;
  portGroup?: string;
  delayAllocation?: boolean;
  keepUuid?: boolean;
  video?: string;
  strategy?: string;
  status: "unconfigured" | "confirmed" | "created";
}

export interface VmConfiguration {
  cpu: {
    totalCores: string;
    reservation: string;
    shares: string;
    limit: string;
    hotPlug: string;
  };
  memory: {
    totalSize: string;
    reservation: string;
    shares: string;
    hotPlug: string;
  };
  disk: { busType: string; slot: string; size: string; type: string };
  network: {
    ip: string;
    mac: string;
    busNumber: string;
    route: string;
    ioRing: string;
    queues: string;
    pollAcceleration: string;
    dns: string;
    gateway: string;
    tcpIpStack: string;
  };
  display: { type: string; memory: string };
}

export interface ValidationVm {
  sourceTaskId: string;
  id: string;
  batchId: string;
  batchPhase: BatchTask["batchPhase"];
  vmName: string;
  uuid: string;
  osType: string;
  source: VmConfiguration;
  target: VmConfiguration;
  comparison: "matched" | "different";
  confirmed: boolean;
}

export interface ExecutionMetric {
  total: number;
  completed: number;
  queued: number;
  running: number;
}

export interface MdHistoryItem {
  id: number;
  time: string;
  title: string;
  detail: string;
}

export type Conversation = Omit<StageConversation, "stageId" | "kind"> & {
  stageId?: StageId;
  kind: "main" | "child" | "temporary";
};
export interface CatalogOption {
  id: string;
  label: string;
}
export interface Catalog {
  agents: CatalogOption[];
  models: CatalogOption[];
  defaultModel: string;
  defaultAgent: string;
  stageAgents?: Partial<Record<StageId, string>>;
}
export interface Artifact {
  id: string;
  label: string;
  filename: string;
  mediaType: string;
  stageId: StageId;
  kind: "input" | "report" | "plan" | "template";
}
export type BusinessResult =
  | {
      kind: "execution-work";
      view: "connection" | "tasks" | "issues" | "validation";
      issueId?: string;
      taskIds?: string[];
    }
  | { kind: "planning-input" }
  | { kind: "planning-preview"; previewId: string }
  | { kind: "assessment-input"; files: { rvtools: string; presales: string } }
  | { kind: "assessment-decision" }
  | {
      kind: "summary";
      title: string;
      metrics: {
        label: string;
        value: number | string;
        tone?: "info" | "success" | "warning" | "danger";
      }[];
      stageId: StageId;
      detail?: string;
    }
  | {
      kind: "tasks";
      title: string;
      taskIds: string[];
      taskKind: ExecutionTaskKind;
    }
  | { kind: "artifacts"; artifactIds: string[] }
  | { kind: "approval"; approvalId: string };
export interface Approval {
  id: string;
  title: string;
  description: string;
  checks: string[];
  status: "pending" | "confirmed";
  action:
    | { kind: "stage"; target: StageId }
    | { kind: "execution"; target: ExecutionTaskKind };
}
export interface PendingReply {
  startedAt: number;
  runId: string;
}
export interface ProjectSnapshot {
  id: string;
  info: ProjectInfo | null;
  revision: number;
  enteredStages: StageId[];
  conversations: Conversation[];
  messages: ChatMessage[];
  pending: Record<string, PendingReply>;
  operations: Record<string, "running" | "completed">;
  assessmentStatus: AssessmentStatus;
  assessmentPlan: AssessmentPlan | null;
  planningStatus: PlanningStatus;
  planning?: PlanningState;
  execution?: ExecutionState;
  vmCount: number;
  files: { rvtools: string; presales: string };
  scopeRevisionFile: string;
  planningWorkbook: string;
  batchConfirmation: BatchConfirmationStatus;
  mdStatus: MdStatus;
  mdHistory: MdHistoryItem[];
  executionApprovals: Record<ExecutionTaskKind, boolean>;
  executionMetrics: Record<ExecutionTaskKind, ExecutionMetric>;
  risks: RiskItem[];
  batchTasks: BatchTask[];
  vmTasks: VmTask[];
  creationTasks: CreationTask[];
  validationTasks: ValidationVm[];
  artifacts: Artifact[];
  approvals: Approval[];
  scopeRows: (string | number)[][];
}
export interface OperationContext {
  operationId?: string;
  projectId: string;
  conversationId: string;
  stageId?: StageId;
  language: "zh-CN" | "en";
}
export type NexentConfiguration =
  | { method: "api-key"; apiKey: string }
  | { method: "account"; username: string; password: string };
export interface AccountState {
  configured: boolean;
  verified: boolean;
  method?: NexentConfiguration["method"];
}
