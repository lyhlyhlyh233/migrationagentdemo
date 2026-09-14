import type {
  AccountState,
  BusinessResult,
  ChatMessage,
  OperationContext,
  ProjectSnapshot,
} from "@/domain/models";
import { translateText } from "@/shared/i18n/text";
import type { RequestOptions, ServiceEvent } from "../contracts";
import { ServiceError, requireCondition } from "../errors";
export class MockRuntime {
  projects = new Map<string, ProjectSnapshot>();
  files = new Map<
    string,
    { filename: string; mediaType: string; body: string }
  >();
  listeners = new Set<(event: ServiceEvent) => void>();
  account: AccountState = { configured: false, verified: false };
  private timers = new Map<ReturnType<typeof setTimeout>, () => void>();
  disposed = false;
  state(id: string) {
    if (this.disposed) throw new ServiceError("ABORTED", "会话已结束");
    const s = this.projects.get(id);
    if (!s) throw new ServiceError("NOT_FOUND", "未找到项目");
    return s;
  }
  context(c: OperationContext) {
    const s = this.state(c.projectId);
    const chat = s.conversations.find((v) => v.id === c.conversationId);
    requireCondition(chat, "未找到发起会话");
    requireCondition(chat.stageId === c.stageId, "会话所属阶段不匹配");
    return s;
  }
  publish(s: ProjectSnapshot) {
    if (this.disposed) return;
    s.revision++;
    this.emit({
      type: "snapshot",
      projectId: s.id,
      snapshot: structuredClone(s),
    });
  }
  emit(event: ServiceEvent) {
    if (!this.disposed) this.listeners.forEach((l) => l(event));
  }
  message(
    c: OperationContext,
    role: ChatMessage["role"],
    text: string,
    extra: Partial<ChatMessage> = {},
  ) {
    const s = this.state(c.projectId);
    s.messages.push({
      id: Date.now() + Math.random(),
      role,
      text: role === "user" ? text : translateText(text, c.language),
      time: new Date().toLocaleTimeString(c.language, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      conversationId: c.conversationId,
      stageId: c.stageId,
      operationId: c.operationId,
      ...extra,
    });
  }
  result(c: OperationContext, text: string, results: BusinessResult[]) {
    const pending = this.state(c.projectId).pending[c.conversationId];
    this.message(c, "agent", text, {
      operation: true,
      results,
      ...(pending
        ? {
            reply: {
              summary: translateText(
                "已核对当前资料、阶段条件和共享任务状态，整理本次结果。",
                c.language,
              ),
              durationMs: Date.now() - pending.startedAt,
            },
          }
        : {}),
    });
  }
  notice(c: OperationContext, text: string) {
    this.emit({
      type: "notice",
      projectId: c.projectId,
      conversationId: c.conversationId,
      text: translateText(text, c.language),
    });
  }
  sleep(ms: number, options: RequestOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.disposed || options.signal?.aborted) {
        reject(new ServiceError("ABORTED", "操作已取消"));
        return;
      }
      const cleanup = () => {
        this.timers.delete(timer);
        options.signal?.removeEventListener("abort", abort);
      };
      const abort = () => {
        clearTimeout(timer);
        cleanup();
        reject(new ServiceError("ABORTED", "操作已取消"));
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);
      this.timers.set(timer, abort);
      options.signal?.addEventListener("abort", abort, { once: true });
    });
  }
  async run(
    c: OperationContext,
    key: string,
    work: (s: ProjectSnapshot) => Promise<void>,
    options: RequestOptions = {},
  ) {
    const s = this.context(c);
    if (options.signal?.aborted)
      throw new ServiceError("ABORTED", "操作已取消");
    if (s.pending[c.conversationId])
      throw new ServiceError("CONFLICT", "当前会话正在处理，请稍后重试");
    if (s.operations[key])
      throw new ServiceError("CONFLICT", "该操作正在执行或已经完成");
    const previous = {
      assessmentStatus: s.assessmentStatus,
      planningStatus: s.planningStatus,
      mdStatus: s.mdStatus,
    };
    s.operations[key] = "running";
    this.publish(s);
    try {
      await work(s);
      if (this.disposed) return;
      s.operations[key] = "completed";
      this.publish(s);
    } catch (error) {
      if (key === "assessment") s.assessmentStatus = previous.assessmentStatus;
      if (key === "planning") s.planningStatus = previous.planningStatus;
      if (key === "md-check") s.mdStatus = previous.mdStatus;
      for (const kind of ["creation", "sync", "cutover"] as const)
        if (key === `execute-${kind}`) {
          s.executionApprovals[kind] = false;
          s.executionMetrics[kind].running = 0;
          const approval = s.approvals.find((v) => v.id === key);
          if (approval) approval.status = "pending";
        }
      delete s.operations[key];
      const pending = s.pending[c.conversationId];
      if (
        pending &&
        (pending.runId === key || `reply-${pending.runId}` === key)
      )
        delete s.pending[c.conversationId];
      this.publish(s);
      throw error;
    }
  }
  dispose() {
    this.disposed = true;
    for (const abort of [...this.timers.values()]) abort();
    this.timers.clear();
    this.listeners.clear();
    this.projects.clear();
    this.files.clear();
    this.account = { configured: false, verified: false };
  }
}
