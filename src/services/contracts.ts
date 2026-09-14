import type {
  AccountState,
  Artifact,
  Catalog,
  Conversation,
  CreationTask,
  ExecutionTaskKind,
  NexentConfiguration,
  OperationContext,
  ProjectInfo,
  ProjectSnapshot,
  StageId,
} from "@/domain/models";
export type ProjectCommand =
  | { type: "assessment.start" }
  | { type: "assessment.useSamples" }
  | { type: "planning.confirmScope" }
  | { type: "planning.useSample" }
  | { type: "planning.requestAdjustment" }
  | { type: "stage.confirm"; target: StageId }
  | { type: "md.check" }
  | { type: "execution.confirm"; kind: ExecutionTaskKind }
  | { type: "creation.update"; tasks: CreationTask[]; create?: boolean }
  | { type: "cutover.complete"; taskIds: string[] }
  | { type: "validation.confirm"; taskIds: string[] }
  | { type: "risk.close"; riskId: number; description: string }
  | {
      type: "tasks.action";
      action: "sync" | "pause" | "delete" | "schedule" | "cancel-schedule";
      taskIds: string[];
    };
export type FilePurpose = "rvtools" | "presales" | "scope" | "planning";
export interface RequestOptions {
  signal?: AbortSignal;
}
export interface Download {
  filename: string;
  mediaType: string;
  blob: Blob;
}
export type ServiceEvent =
  | { type: "snapshot"; projectId: string; snapshot: ProjectSnapshot }
  | { type: "notice"; projectId: string; conversationId?: string; text: string }
  | {
      type: "error";
      projectId: string;
      conversationId?: string;
      message: string;
    };
export interface MigrationService {
  catalog(options?: RequestOptions): Promise<Catalog>;
  listProjects(
    options?: RequestOptions,
  ): Promise<{ id: string; info: ProjectInfo }[]>;
  createProject(
    info: ProjectInfo,
    language: OperationContext["language"],
    options?: RequestOptions,
  ): Promise<ProjectSnapshot>;
  getProject(id: string, options?: RequestOptions): Promise<ProjectSnapshot>;
  createConversation(
    projectId: string,
    stageId: StageId | undefined,
    language: OperationContext["language"],
    options?: RequestOptions,
  ): Promise<Conversation>;
  renameConversation(
    projectId: string,
    id: string,
    title: string,
    options?: RequestOptions,
  ): Promise<void>;
  sendMessage(
    context: OperationContext,
    input: {
      text: string;
      agentId: string;
      modelId: string;
      requestId: string;
    },
    options?: RequestOptions,
  ): Promise<void>;
  execute(
    context: OperationContext,
    command: ProjectCommand,
    options?: RequestOptions,
  ): Promise<void>;
  upload(
    context: OperationContext,
    purpose: FilePurpose,
    file: File,
    options?: RequestOptions,
  ): Promise<void>;
  download(
    projectId: string,
    artifactId: Artifact["id"],
    options?: RequestOptions,
  ): Promise<Download>;
  getAccount(options?: RequestOptions): Promise<AccountState>;
  configureAccount(
    config: NexentConfiguration | null,
    options?: RequestOptions,
  ): Promise<AccountState>;
  logout(options?: RequestOptions): Promise<void>;
  subscribe(listener: (event: ServiceEvent) => void): () => void;
  dispose(): void;
}
