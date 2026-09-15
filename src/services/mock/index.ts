import {
  EMPTY_WORKSPACE_ID,
  type Catalog,
  type Conversation,
  type NexentConfiguration,
  type OperationContext,
  type ProjectInfo,
  type ProjectSnapshot,
  type StageId,
} from "@/domain/models";
import type {
  FilePurpose,
  MigrationService,
  ProjectCommand,
  RequestOptions,
  ServiceEvent,
} from "../contracts";
import { ServiceError, requireCondition } from "../errors";
import { uploadExecutionAttachment, validationReport } from "./validation";
import { command } from "./commands";
import { reply } from "./conversations";
import { assessmentWelcome } from "./assessment-knowledge";
import { researchTemplate, scopeArtifacts } from "./files";
import { previewPlanning } from "./planning";
import { initializePlanning } from "./planning-data";
import { planningFiles } from "./planning-files";
import { assessmentFileIds, assessmentFiles } from "./assessment-files";
import { MockRuntime } from "./runtime";
import { createStageConversation } from "./fixtures";
const catalog: Catalog = {
  agents: [
    { id: "general", label: "通用智能体" },
    { id: "research", label: "评估智能体" },
    { id: "planning", label: "规划智能体" },
    { id: "migration", label: "实施智能体" },
    { id: "validation", label: "验证智能体" },
  ],
  models: [
    { id: "glm-5.1", label: "GLM 5.1" },
    { id: "deepseek-v4", label: "DeepSeek v4" },
  ],
  defaultModel: "glm-5.1",
  defaultAgent: "general",
  stageAgents: {
    research: "research",
    planning: "planning",
    migration: "migration",
    validation: "validation",
  },
};
export class MockMigrationService implements MigrationService {
  readonly runtime = new MockRuntime();
  private readonly downloads = new AbortController();
  constructor() {
    this.initialize(EMPTY_WORKSPACE_ID, null, "zh-CN");
  }
  private active(options: RequestOptions = {}) {
    if (this.runtime.disposed || options.signal?.aborted)
      throw new ServiceError("ABORTED", "会话已结束或操作已取消");
  }
  private initialize(
    id: string,
    info: ProjectInfo | null,
    language: OperationContext["language"],
  ) {
    const metric = () => ({ total: 0, completed: 0, queued: 0, running: 0 });
    const s: ProjectSnapshot = {
      id,
      info,
      revision: 0,
      enteredStages: info ? ["research"] : [],
      conversations: info ? [createStageConversation("research")] : [],
      messages: [],
      pending: {},
      operations: {},
      assessmentStatus: "idle",
      assessmentPlan: null,
      planningStatus: "locked",
      vmCount: 200,
      files: { rvtools: "", presales: "" },
      scopeRevisionFile: "",
      planningWorkbook: "",
      batchConfirmation: "pending",
      mdStatus: "unconfigured",
      mdHistory: [],
      executionApprovals: { creation: false, sync: false, cutover: false },
      executionMetrics: {
        creation: metric(),
        sync: metric(),
        cutover: metric(),
      },
      risks: [],
      batchTasks: [],
      vmTasks: [],
      creationTasks: [],
      validationTasks: [],
      artifacts: [],
      approvals: [],
      scopeRows: Array.from({ length: 200 }, (_, i) => [
        `VM-${i % 3 === 0 ? "DB" : i % 3 === 1 ? "APP" : "WEB"}-${String(i + 1).padStart(3, "0")}`,
        `10.0.0.${i + 1}`,
        4,
        16,
        "生产资源池",
      ]),
    };
    this.runtime.projects.set(id, s);
    if (info) {
      scopeArtifacts(this.runtime, s);
      const c = {
        projectId: id,
        conversationId: s.conversations[0].id,
        stageId: "research" as const,
        language,
      };
      this.runtime.message(
        c,
        "system",
        `项目「${info.siteName}」已创建，评估会话已开启。`,
        { operation: true, activity: "assessment-preparation" },
      );
      this.runtime.message(c, "user", "开始虚拟化迁移项目的调研评估", {
        operation: true,
      });
      void this.runtime
        .run(c, "assessment-intro", async (_s, options, runId) => {
          s.pending[c.conversationId] = {
            startedAt: Date.now(),
            runId,
          };
          this.runtime.publish(s);
          await this.runtime.sleep(1200, options);
          this.runtime.result(
            c,
            assessmentWelcome,
            [{ kind: "assessment-input", files: { ...s.files } }],
            { activity: "assessment-preparation" },
          );
          delete s.pending[c.conversationId];
        })
        .catch((error) => {
          if (
            !this.runtime.disposed &&
            !(error instanceof ServiceError && error.code === "STOPPED")
          )
            this.runtime.notice(
              c,
              error instanceof Error
                ? error.message
                : "启动对话失败，请重新打开评估资料",
            );
        });
    }
    return s;
  }
  async catalog(options: RequestOptions = {}) {
    this.active(options);
    return structuredClone(catalog);
  }
  async listProjects(options: RequestOptions = {}) {
    this.active(options);
    return [...this.runtime.projects.values()]
      .filter((s) => s.info)
      .map((s) => ({ id: s.id, info: structuredClone(s.info!) }));
  }
  async createProject(
    info: ProjectInfo,
    language: OperationContext["language"],
    options: RequestOptions = {},
  ) {
    this.active(options);
    requireCondition(
      info.siteName.trim() && info.office.trim(),
      "请填写项目名称和代表处",
    );
    const s = this.initialize(
      crypto.randomUUID(),
      { ...info, siteName: info.siteName.trim(), office: info.office.trim() },
      language,
    );
    this.runtime.publish(s);
    return structuredClone(s);
  }
  async getProject(id: string, options: RequestOptions = {}) {
    this.active(options);
    return structuredClone(this.runtime.state(id));
  }
  async createConversation(
    projectId: string,
    stageId: StageId | undefined,
    language: OperationContext["language"],
    options: RequestOptions = {},
  ) {
    this.active(options);
    const s = this.runtime.state(projectId);
    requireCondition(
      !stageId || s.enteredStages.includes(stageId),
      "请先开启对应阶段",
    );
    const chat: Conversation = {
      id: crypto.randomUUID(),
      title: stageId ? "新会话" : language === "en" ? "New chat" : "新聊天",
      kind: stageId ? "child" : "temporary",
      stageId,
    };
    s.conversations.push(chat);
    this.runtime.publish(s);
    return structuredClone(chat);
  }
  async renameConversation(
    projectId: string,
    id: string,
    title: string,
    options: RequestOptions = {},
  ) {
    this.active(options);
    const s = this.runtime.state(projectId);
    const chat = s.conversations.find((c) => c.id === id);
    requireCondition(chat && title.trim(), "请填写会话名称");
    chat.title = title.trim().slice(0, 40);
    chat.manuallyNamed = true;
    this.runtime.publish(s);
  }
  async sendMessage(
    c: OperationContext,
    input: {
      text: string;
      agentId: string;
      modelId: string;
      requestId: string;
      context?: string;
    },
    options: RequestOptions = {},
  ) {
    this.active(options);
    requireCondition(
      catalog.agents.some((a) => a.id === input.agentId) &&
        catalog.models.some((m) => m.id === input.modelId),
      "智能体或模型不可用",
    );
    return reply(this.runtime, c, input, options);
  }
  async stopReply(
    c: OperationContext,
    runId: string,
    options: RequestOptions = {},
  ) {
    this.active(options);
    await this.runtime.stopReply(c, runId);
  }
  async execute(
    c: OperationContext,
    cmd: ProjectCommand,
    options: RequestOptions = {},
  ) {
    this.active(options);
    return command(this.runtime, c, cmd, options);
  }
  async upload(
    c: OperationContext,
    purpose: FilePurpose,
    file: File,
    options: RequestOptions = {},
  ) {
    this.active(options);
    const s = this.runtime.context(c);
    if (purpose.startsWith("issue:") || purpose.startsWith("feedback:"))
      return uploadExecutionAttachment(this.runtime, c, purpose, file);
    requireCondition(
      /\.(xlsx?|csv)$/i.test(file.name),
      "请选择 XLSX、XLS 或 CSV 文件",
    );
    if (purpose === "rvtools" || purpose === "presales") {
      requireCondition(
        c.stageId === "research" &&
          ["idle", "ready"].includes(s.assessmentStatus),
        "评估资料已锁定",
      );
      s.files[purpose] = file.name;
      s.assessmentStatus =
        s.files.rvtools && s.files.presales ? "ready" : "idle";
    } else if (purpose === "scope") {
      requireCondition(
        c.stageId === "planning" && s.planningStatus === "scope-review",
        "当前范围不可修改",
      );
      s.scopeRevisionFile = file.name;
      s.scopeRows = s.scopeRows.slice(0, Math.max(0, s.scopeRows.length - 4));
      s.vmCount = s.scopeRows.length;
      s.planningStatus = "details-pending";
      scopeArtifacts(this.runtime, s);
    } else {
      requireCondition(
        file.size <= 20 * 1024 * 1024,
        "文件超过 20 MB，请缩小后重试",
      );
      const p = initializePlanning(s);
      const preview = previewPlanning(
        this.runtime,
        c,
        { kind: "import", filename: file.name },
        p.revision,
      );
      this.runtime.message(c, "user", `上传规划资料：${file.name}`, {
        operation: true,
      });
      this.runtime.result(
        c,
        "文件已接收。本轮展示示例解析结果，尚未读取实际表格内容。确认后仅补充示例业务资料，已有填写会保留。",
        [{ kind: "planning-preview", previewId: preview.id }],
      );
      this.runtime.publish(s);
      return;
    }
    this.runtime.message(c, "user", `已上传：${file.name}`, {
      operation: true,
      activity: c.stageId === "research" ? "assessment-preparation" : undefined,
    });
    this.runtime.result(
      c,
      purpose === "scope"
        ? "范围修订已收到。请继续补充业务依赖和迁移窗口。"
        : s.assessmentStatus === "ready"
          ? "两份资料已收到。评估会检查 GuestOS、磁盘模式、应用适配和目标容量；现在可以开始评估。当前为模拟执行，上传内容尚未解析。"
          : "资料已收到。还需要另一份资料，才能同时核对源端配置与目标端要求。",
      purpose === "scope"
        ? []
        : [{ kind: "assessment-input", files: { ...s.files } }],
      {
        activity:
          c.stageId === "research" ? "assessment-preparation" : undefined,
      },
    );
    this.runtime.publish(s);
  }
  async download(
    projectId: string,
    artifactId: string,
    options: RequestOptions = {},
  ) {
    this.active(options);
    const s = this.runtime.state(projectId);
    if (assessmentFileIds.includes(artifactId)) {
      requireCondition(s.assessmentStatus === "completed", "请先完成调研评估");
      assessmentFiles(this.runtime, s);
      if (artifactId === "assessment-report") {
        const snapshot = structuredClone(s);
        const { assessmentPresentation } =
          await import("./assessment-presentation");
        this.active(options);
        const blob = await assessmentPresentation(snapshot);
        this.active(options);
        const artifact = snapshot.artifacts.find((a) => a.id === artifactId)!;
        return {
          filename: artifact.filename,
          mediaType: artifact.mediaType,
          blob,
        };
      }
    }
    if (artifactId === "validation-report")
      validationReport(this.runtime, projectId);
    const attachment = this.runtime.attachments.get(
      `${projectId}/${artifactId}`,
    );
    if (attachment) return attachment;
    if (
      s.planning &&
      ["planning-template", "batch-plan", "runbook"].includes(artifactId)
    )
      planningFiles(this.runtime, s);
    if (artifactId === "research-template") {
      requireCondition(s.info, "请先创建或选择项目");
      const signal = options.signal
        ? AbortSignal.any([options.signal, this.downloads.signal])
        : this.downloads.signal;
      try {
        const file = await researchTemplate(signal);
        this.active(options);
        return file;
      } catch (error) {
        this.active(options);
        if (error instanceof ServiceError) throw error;
        throw new ServiceError("NETWORK", "模板下载失败，请重试。");
      }
    }
    if (artifactId.startsWith("task-log:")) {
      const ids = artifactId.slice(9).split(",");
      const tasks = s.vmTasks.filter((v) => ids.includes(v.id));
      requireCondition(tasks.length, "未找到任务");
      return {
        filename: "migration-task-log.txt",
        mediaType: "text/plain;charset=utf-8",
        blob: new Blob(
          [
            tasks
              .map((v) => `${v.id} ${v.name} ${v.status} ${v.progress}%`)
              .join("\n"),
          ],
          { type: "text/plain;charset=utf-8" },
        ),
      };
    }
    const file = this.runtime.files.get(`${projectId}/${artifactId}`);
    if (!file) throw new ServiceError("NOT_FOUND", "文件尚未生成");
    return {
      filename: file.filename,
      mediaType: file.mediaType,
      blob: new Blob([file.body], { type: file.mediaType }),
    };
  }
  async getAccount(options: RequestOptions = {}) {
    this.active(options);
    return { ...this.runtime.account };
  }
  async configureAccount(
    config: NexentConfiguration | null,
    options: RequestOptions = {},
  ) {
    this.active(options);
    if (config) {
      requireCondition(
        config.method === "api-key"
          ? !!config.apiKey.trim() && !/\s/.test(config.apiKey.trim())
          : !!config.username.trim() && !!config.password.trim(),
        "认证配置格式不正确",
      );
    }
    this.runtime.account = {
      configured: !!config,
      verified: false,
      method: config?.method,
    };
    return { ...this.runtime.account };
  }
  async logout(options: RequestOptions = {}) {
    this.active(options);
    this.dispose();
  }
  subscribe(listener: (event: ServiceEvent) => void) {
    this.runtime.listeners.add(listener);
    return () => {
      this.runtime.listeners.delete(listener);
    };
  }
  dispose() {
    this.downloads.abort();
    this.runtime.dispose();
  }
}
