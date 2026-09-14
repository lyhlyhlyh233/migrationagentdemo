import { createStageConversation, type StageId } from "@/domain/models";
import { canExecute, stageEligibility } from "@/domain/policies";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockMigrationService } from "../mock";
import { buildBatchTasks, buildVmTasks } from "../mock/fixtures";
const info = {
  industry: "金融",
  region: "中国地区部",
  office: "上海",
  siteName: "隔离检查",
  migrationType: "虚拟化",
};
let service: MockMigrationService;
beforeEach(() => {
  vi.useFakeTimers();
  service = new MockMigrationService();
});
afterEach(() => {
  service.dispose();
  vi.useRealTimers();
});
async function project() {
  const s = await service.createProject(info, "zh-CN");
  return {
    projectId: s.id,
    conversationId: s.conversations[0].id,
    stageId: "research" as StageId,
    language: "zh-CN" as const,
  };
}
async function finish(p: Promise<unknown>) {
  const checked = p.catch((e) => {
    throw e;
  });
  await vi.runAllTimersAsync();
  return checked;
}
async function migration() {
  const c = await project();
  const s = service.runtime.state(c.projectId);
  s.enteredStages = ["research", "planning", "migration"];
  s.conversations.push(
    createStageConversation("planning"),
    createStageConversation("migration"),
  );
  s.assessmentStatus = "completed";
  s.planningStatus = "completed";
  s.batchConfirmation = "confirmed";
  s.batchTasks = buildBatchTasks(s.scopeRows.map((r) => String(r[0])));
  s.vmTasks = s.batchTasks.flatMap(buildVmTasks);
  const m = {
    ...c,
    stageId: "migration" as const,
    conversationId: "stage-migration-main",
  };
  await finish(service.execute(m, { type: "md.check" }));
  return m;
}
describe("project service boundaries", () => {
  it("requires risk closure and explicit handoff; handoff creates a new main chat once", async () => {
    const c = await project();
    await service.execute(c, { type: "assessment.useSamples" });
    await finish(service.execute(c, { type: "assessment.start" }));
    let s = await service.getProject(c.projectId);
    expect(s.enteredStages).toEqual(["research"]);
    expect(stageEligibility(s).planning).toBe(false);
    await expect(
      service.execute(c, { type: "stage.confirm", target: "planning" }),
    ).rejects.toThrow();
    for (const r of s.risks.filter((r) => r.level === "high"))
      await service.execute(c, {
        type: "risk.close",
        riskId: r.id,
        description: "已验证兼容性",
      });
    s = await service.getProject(c.projectId);
    expect(stageEligibility(s).planning).toBe(true);
    expect(s.enteredStages).toEqual(["research"]);
    expect(s.approvals.find((a) => a.id === "enter-planning")?.status).toBe(
      "pending",
    );
    await service.execute(c, { type: "stage.confirm", target: "planning" });
    await expect(
      service.execute(c, { type: "stage.confirm", target: "planning" }),
    ).rejects.toThrow();
    expect(
      (await service.getProject(c.projectId)).conversations.filter(
        (v) => v.stageId === "planning",
      ),
    ).toHaveLength(1);
  });
  it("isolates asynchronous responses and auto titles by project and initiating chat", async () => {
    const c = await project();
    const second = await project();
    const a = await service.createConversation(
      c.projectId,
      "research",
      "zh-CN",
    );
    const b = await service.createConversation(
      c.projectId,
      "research",
      "zh-CN",
    );
    const request = {
      text: "总结当前项目范围",
      agentId: "research",
      modelId: "glm-5.1",
      requestId: "reply-a",
    };
    const pending = service.sendMessage(
      { ...c, conversationId: a.id },
      request,
    );
    await service.renameConversation(c.projectId, b.id, "独立核对");
    await finish(pending);
    const s = await service.getProject(c.projectId);
    expect(
      s.messages
        .filter((m) => m.requestId === "reply-a")
        .every((m) => m.conversationId === a.id),
    ).toBe(true);
    expect(s.messages.some((m) => m.conversationId === b.id)).toBe(false);
    expect(s.conversations.find((v) => v.id === a.id)?.title).toBe(
      request.text,
    );
    expect(
      (await service.getProject(second.projectId)).messages,
    ).not.toContainEqual(expect.objectContaining({ requestId: "reply-a" }));
    expect(s.pending).toEqual({});
  });
  it("aborted assessment is retryable and keeps uploaded files", async () => {
    const c = await project();
    await service.upload(c, "rvtools", new File(["sample"], "assets.xlsx"));
    await service.upload(c, "presales", new File(["sample"], "presales.xlsx"));
    const abort = new AbortController();
    const pending = service.execute(
      c,
      { type: "assessment.start" },
      { signal: abort.signal },
    );
    const rejected = expect(pending).rejects.toMatchObject({ code: "ABORTED" });
    abort.abort();
    await rejected;
    expect((await service.getProject(c.projectId)).assessmentStatus).toBe(
      "ready",
    );
    await finish(service.execute(c, { type: "assessment.start" }));
    expect((await service.getProject(c.projectId)).assessmentStatus).toBe(
      "completed",
    );
  });
  it("message retry reuses a request without duplicating the user message", async () => {
    const c = await project();
    const input = {
      text: "迁移建议",
      agentId: "general",
      modelId: "deepseek-v4",
      requestId: "retry",
    };
    const abort = new AbortController();
    const pending = service.sendMessage(c, input, { signal: abort.signal });
    const rejected = expect(pending).rejects.toThrow();
    abort.abort();
    await rejected;
    await finish(service.sendMessage(c, input));
    const messages = (await service.getProject(c.projectId)).messages.filter(
      (m) => m.requestId === "retry",
    );
    expect(messages.map((m) => m.role)).toEqual(["user", "agent"]);
  });
  it("two chats share execution state and cannot repeat the same operation", async () => {
    const c = await migration();
    const child = await service.createConversation(
      c.projectId,
      "migration",
      "zh-CN",
    );
    const pending = service.execute(c, {
      type: "execution.confirm",
      kind: "creation",
    });
    await expect(
      service.execute(
        { ...c, conversationId: child.id },
        { type: "execution.confirm", kind: "creation" },
      ),
    ).rejects.toThrow();
    await finish(pending);
    const s = await service.getProject(c.projectId);
    expect(s.creationTasks).toHaveLength(12);
    expect(s.creationTasks.every((t) => t.status === "created")).toBe(true);
    expect(canExecute(s, "creation")).toBe(false);
    expect(
      s.messages.filter((m) =>
        m.results?.some((r) => r.kind === "tasks" && r.taskKind === "creation"),
      ),
    ).toHaveLength(1);
  });
  it("partial cutover resumes only remaining resources and offers handoff without navigating", async () => {
    const c = await migration();
    const s = service.runtime.state(c.projectId);
    const ids = s.vmTasks
      .filter(
        (v) =>
          s.batchTasks.find((b) => b.id === v.batchId)?.stageType === "cutover",
      )
      .map((v) => v.id);
    await service.execute(c, {
      type: "cutover.complete",
      taskIds: [ids.at(-1)!],
    });
    await finish(
      service.execute(c, { type: "execution.confirm", kind: "cutover" }),
    );
    const result = await service.getProject(c.projectId);
    expect(new Set(result.validationTasks.map((v) => v.id)).size).toBe(
      ids.length,
    );
    expect(result.enteredStages).not.toContain("validation");
    expect(result.approvals.some((a) => a.id === "enter-validation")).toBe(
      true,
    );
  });
  it("keeps historical statistics immutable and serves files in project scope", async () => {
    const c = await project();
    await service.execute(c, { type: "assessment.useSamples" });
    await finish(service.execute(c, { type: "assessment.start" }));
    const before = await service.getProject(c.projectId);
    const risk = before.risks.find((r) => r.level === "high")!;
    await service.execute(c, {
      type: "risk.close",
      riskId: risk.id,
      description: "确认闭环",
    });
    const s = await service.getProject(c.projectId);
    expect(s.messages.find((m) => m.results)?.results).toEqual(
      before.messages.find((m) => m.results)?.results,
    );
    const file = await service.download(c.projectId, "assessment-report");
    expect(file.filename).toContain(info.siteName);
    expect(await file.blob.text()).toContain("高风险：2");
    const another = await project();
    await expect(
      service.download(another.projectId, "assessment-report"),
    ).rejects.toThrow();
    before.risks[0].description = "mutated";
    expect(
      (await service.getProject(c.projectId)).risks[0].description,
    ).not.toBe("mutated");
  });
  it("logout aborts in-flight requests and clears subscriptions and account state", async () => {
    const c = await project();
    const events = vi.fn();
    service.subscribe(events);
    await service.configureAccount({
      method: "api-key",
      apiKey: "test-only-placeholder",
    });
    const pending = service.sendMessage(c, {
      text: "test",
      agentId: "general",
      modelId: "glm-5.1",
      requestId: "logout",
    });
    const rejected = expect(pending).rejects.toMatchObject({ code: "ABORTED" });
    await service.logout();
    await rejected;
    const count = events.mock.calls.length;
    await vi.runAllTimersAsync();
    expect(events).toHaveBeenCalledTimes(count);
    expect(service.runtime.projects.size).toBe(0);
    expect(service.runtime.listeners.size).toBe(0);
    expect(service.runtime.account.configured).toBe(false);
    await expect(service.createProject(info, "zh-CN")).rejects.toThrow();
  });
});
