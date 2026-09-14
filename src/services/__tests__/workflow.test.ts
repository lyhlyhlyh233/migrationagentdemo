import { createStageConversation, type StageId } from "@/domain/models";
import { migrationScope, riskReadyForExecution } from "@/domain/assessment";
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
  await vi.runAllTimersAsync();
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
  it("allows optional risk decisions while keeping an explicit, single stage handoff", async () => {
    const c = await project();
    await service.execute(c, { type: "assessment.useSamples" });
    await finish(service.execute(c, { type: "assessment.start" }));
    let s = await service.getProject(c.projectId);
    expect(s.enteredStages).toEqual(["research"]);
    expect(s.risks.every((r) => !r.decision)).toBe(true);
    expect(migrationScope(s).length).toBeLessThan(s.vmCount);
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
  it("starts with an automatic user message, thinking and an input result in the first chat", async () => {
    const s = await service.createProject(info, "zh-CN");
    expect(
      s.messages.some(
        (m) => m.role === "user" && m.text === "开始虚拟化迁移项目的调研评估",
      ),
    ).toBe(true);
    expect(s.pending[s.conversations[0].id]).toBeDefined();
    await vi.runAllTimersAsync();
    const ready = await service.getProject(s.id);
    const answer = ready.messages.find((m) =>
      m.results?.some((r) => r.kind === "assessment-input"),
    );
    expect(answer?.reply?.durationMs).toBeGreaterThanOrEqual(1000);
    expect(answer?.conversationId).toBe(s.conversations[0].id);
  });
  it("skipping all assessment risk decisions never sends blocked VMs to implementation", async () => {
    const c = await project();
    await service.execute(c, { type: "assessment.useSamples" });
    await finish(service.execute(c, { type: "assessment.start" }));
    const assessment = await service.getProject(c.projectId);
    const excluded = new Set(
      assessment.risks
        .filter((r) => !riskReadyForExecution(r))
        .map((r) => r.vmName),
    );
    const constrained = assessment.risks.find(
      (r) => r.impact === "constraint",
    )!.vmName;
    await service.execute(c, { type: "stage.review", target: "planning" });
    await service.execute(c, { type: "stage.confirm", target: "planning" });
    const p = {
      ...c,
      stageId: "planning" as const,
      conversationId: "stage-planning-main",
    };
    await service.execute(p, { type: "planning.confirmScope" });
    await finish(service.execute(p, { type: "planning.useSample" }));
    await service.execute(p, { type: "stage.confirm", target: "migration" });
    const m = {
      ...c,
      stageId: "migration" as const,
      conversationId: "stage-migration-main",
    };
    await finish(service.execute(m, { type: "md.check" }));
    const ready = await service.getProject(c.projectId);
    expect(ready.vmTasks.every((v) => !excluded.has(v.name))).toBe(true);
    expect(ready.creationTasks.every((v) => !excluded.has(v.vmName))).toBe(
      true,
    );
    expect(ready.batchTasks.flatMap((b) => b.vmNames)).toContain(constrained);
    expect(
      ready.risks
        .filter((r) => r.stage === "research")
        .every((r) => !r.decision),
    ).toBe(true);
    expect(
      ready.messages.findLast((m) =>
        m.results?.some((r) => r.kind === "approval"),
      )?.conversationId,
    ).toBe(m.conversationId);
  });
  it("preserves newer per-VM exceptions when a category command uses onlyUndecided", async () => {
    const c = await project();
    await service.execute(c, { type: "assessment.useSamples" });
    await finish(service.execute(c, { type: "assessment.start" }));
    const original = await service.getProject(c.projectId);
    const targets = original.risks.filter((r) => r.category === "disk");
    const child = await service.createConversation(
      c.projectId,
      "research",
      "zh-CN",
    );
    const other = { ...c, conversationId: child.id };
    await service.execute(other, {
      type: "risk.decide",
      riskIds: [targets[0].id],
      decision: {
        strategy: "exclude",
        method: "manual",
        note: "这台虚拟机保留单独处置方案",
      },
    });
    const saved = (await service.getProject(c.projectId)).risks.find(
      (r) => r.id === targets[0].id,
    )!;
    await service.execute(c, {
      type: "risk.recommend",
      riskIds: targets.map((r) => r.id),
      onlyUndecided: true,
    });
    const result = await service.getProject(c.projectId);
    expect(result.risks.find((r) => r.id === saved.id)?.decision).toEqual(
      saved.decision,
    );
    expect(
      result.risks
        .filter((r) => targets.some((t) => t.id === r.id) && r.id !== saved.id)
        .every((r) => r.decision?.strategy === r.recommendedStrategy),
    ).toBe(true);
    expect(result.messages.at(-1)?.conversationId).toBe(c.conversationId);
    expect(result.messages.at(-1)?.text).toContain("保留 1 条已有选择");
    const beforeNoop = result.messages.length;
    await expect(
      service.execute(c, {
        type: "risk.recommend",
        riskIds: targets.map((r) => r.id),
        onlyUndecided: true,
      }),
    ).rejects.toThrow("已有策略");
    expect((await service.getProject(c.projectId)).messages.length).toBe(
      beforeNoop,
    );
    expect(
      result.risks
        .filter((r) => r.decision?.strategy === "remediate")
        .every((r) => !riskReadyForExecution(r)),
    ).toBe(true);
  });
  it("shares batch strategies, rejects invalid ignores atomically, and distinguishes remediation from verification", async () => {
    const c = await project();
    await service.execute(c, { type: "assessment.useSamples" });
    await finish(service.execute(c, { type: "assessment.start" }));
    const before = await service.getProject(c.projectId);
    const blocked = before.risks.find((r) => r.impact === "blocked")!;
    const change = before.risks.find((r) => r.impact === "change")!;
    const child = await service.createConversation(
      c.projectId,
      "research",
      "zh-CN",
    );
    const from = { ...c, conversationId: child.id };
    await expect(
      service.execute(from, {
        type: "risk.decide",
        riskIds: [blocked.id, change.id],
        decision: {
          strategy: "ignore",
          method: "agentless",
          note: "忽略全部风险",
        },
      }),
    ).rejects.toThrow();
    expect(
      (await service.getProject(c.projectId)).risks.every((r) => !r.decision),
    ).toBe(true);
    await service.execute(from, {
      type: "risk.recommend",
      riskIds: [blocked.id, change.id],
    });
    let s = await service.getProject(c.projectId);
    expect(s.risks.find((r) => r.id === change.id)?.closed).toBe(false);
    expect(migrationScope(s).some((row) => row[0] === change.vmName)).toBe(
      false,
    );
    await service.execute(from, {
      type: "risk.close",
      riskId: change.id,
      description: "已补采版本并人工核对两份兼容性清单。",
    });
    s = await service.getProject(c.projectId);
    expect(migrationScope(s).some((row) => row[0] === change.vmName)).toBe(
      true,
    );
    expect(migrationScope(s).some((row) => row[0] === blocked.vmName)).toBe(
      false,
    );
    expect(s.messages.at(-1)?.conversationId).toBe(child.id);
    const other = await project();
    expect((await service.getProject(other.projectId)).risks).toEqual([]);
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
    const risk = before.risks.find((r) => r.impact === "change")!;
    await service.execute(c, { type: "risk.recommend", riskIds: [risk.id] });
    const s = await service.getProject(c.projectId);
    expect(s.messages.find((m) => m.results)?.results).toEqual(
      before.messages.find((m) => m.results)?.results,
    );
    const file = await service.download(c.projectId, "assessment-report");
    expect(file.filename).toContain(info.siteName);
    expect(await file.blob.text()).toContain("CPU 架构检查");
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
