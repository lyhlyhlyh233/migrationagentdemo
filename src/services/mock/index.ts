import {
  createStageConversation,
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
import { command } from "./commands";
import { reply } from "./conversations";
import { scopeArtifacts } from "./files";
import { plan } from "./planning";
import { MockRuntime } from "./runtime";
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
};
export class MockMigrationService implements MigrationService {
  readonly runtime = new MockRuntime();
  constructor() {
    this.initialize("lobby", null, "zh-CN");
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
      planningStatus: "locked",
      vmCount: 128,
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
      scopeRows: Array.from({ length: 128 }, (_, i) => [
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
        { operation: true },
      );
      this.runtime.message(
        c,
        "agent",
        "我们从调研评估开始。请上传 RVTools 采集表和售前调用表，也可以先使用示例资料体验流程。\n\n我会核对资产清单与兼容性，把结果汇总到项目风险和交付件中。",
      );
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
  async getProject(id: string) {
    return structuredClone(this.runtime.state(id));
  }
  async createConversation(
    projectId: string,
    stageId: StageId | undefined,
    language: OperationContext["language"],
  ) {
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
  async renameConversation(projectId: string, id: string, title: string) {
    const s = this.runtime.state(projectId);
    const chat = s.conversations.find((c) => c.id === id);
    requireCondition(chat && title.trim(), "请填写会话名称");
    chat.title = title.trim().slice(0, 40);
    chat.manuallyNamed = true;
    this.runtime.publish(s);
  }
  sendMessage(
    c: OperationContext,
    input: {
      text: string;
      agentId: string;
      modelId: string;
      requestId: string;
    },
    options: RequestOptions = {},
  ) {
    requireCondition(
      catalog.agents.some((a) => a.id === input.agentId) &&
        catalog.models.some((m) => m.id === input.modelId),
      "智能体或模型不可用",
    );
    return reply(this.runtime, c, input, options);
  }
  execute(
    c: OperationContext,
    cmd: ProjectCommand,
    options: RequestOptions = {},
  ) {
    return command(this.runtime, c, cmd, options);
  }
  async upload(
    c: OperationContext,
    purpose: FilePurpose,
    file: File,
    options: RequestOptions = {},
  ) {
    const s = this.runtime.context(c);
    requireCondition(
      /\.(xlsx?|csv)$/i.test(file.name),
      "请选择 XLSX、XLS 或 CSV 文件",
    );
    if (options.signal?.aborted)
      throw new ServiceError("ABORTED", "操作已取消");
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
      s.vmCount = 124;
      s.scopeRows = s.scopeRows.slice(0, 124);
      s.planningStatus = "details-pending";
      scopeArtifacts(this.runtime, s);
    } else return plan(this.runtime, c, file.name, options);
    this.runtime.message(c, "user", `已上传：${file.name}`, {
      operation: true,
    });
    this.runtime.publish(s);
  }
  async download(projectId: string, artifactId: string) {
    const s = this.runtime.state(projectId);
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
  async logout() {
    this.dispose();
  }
  subscribe(listener: (event: ServiceEvent) => void) {
    this.runtime.listeners.add(listener);
    return () => {
      this.runtime.listeners.delete(listener);
    };
  }
  dispose() {
    this.runtime.dispose();
  }
}
