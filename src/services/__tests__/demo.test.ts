import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationContext, StageId } from "@/domain/models";
import { hasActiveControl } from "@/domain/execution";
import { stageEligibility } from "@/domain/policies";
import { MockMigrationService } from "../mock";

let service: MockMigrationService;
beforeEach(() => {
  vi.useFakeTimers();
  service = new MockMigrationService();
});
afterEach(() => {
  service.dispose();
  vi.useRealTimers();
});
const info = {
  industry: "IT",
  region: "CN",
  office: "示例代表处",
  siteName: "演示推进",
  migrationType: "vm",
};
async function project() {
  const s = await service.createProject(info, "zh-CN");
  await vi.runAllTimersAsync();
  return {
    projectId: s.id,
    conversationId: s.conversations[0].id,
    stageId: "research",
    language: "zh-CN",
  } satisfies OperationContext;
}
function context(c: OperationContext, stageId: StageId): OperationContext {
  return { ...c, stageId, conversationId: `stage-${stageId}-main` };
}
async function migration() {
  const c = await project();
  await service.execute(c, { type: "stage.confirm", target: "planning" });
  await service.execute(context(c, "planning"), {
    type: "stage.confirm",
    target: "migration",
  });
  await vi.runAllTimersAsync();
  return { c: context(c, "migration"), s: service.runtime.state(c.projectId) };
}
async function timed(p: Promise<void>, ms = 2000) {
  const settled = p.then(
    () => undefined,
    (error: unknown) => error,
  );
  await vi.advanceTimersByTimeAsync(ms);
  const error = await settled;
  if (error) throw error;
}

describe("Mock walkthrough and confirmation notes", () => {
  it("continues all stages with missing input while retaining explicit confirmation and strict adapters", async () => {
    const { c, s } = await migration();
    expect(s.demoMode).toBe(true);
    expect(s.assessmentStatus).toBe("completed");
    expect(s.planningStatus).toBe("completed");
    expect(s.planning!.batches).toHaveLength(8);
    expect(s.execution!.tasks).toHaveLength(186);
    expect(s.risks).toHaveLength(26);
    expect(s.artifacts.some((a) => a.id === "assessment-report")).toBe(true);
    expect(s.execution!.connectionStatus).toBe("unconfigured");
    await service.execute(c, { type: "stage.confirm", target: "validation" });
    expect(s.enteredStages).toEqual([
      "research",
      "planning",
      "migration",
      "validation",
    ]);
    expect(s.execution!.connectionStatus).toBe("ready");
    expect(s.validationTasks.length).toBeGreaterThan(0);
    expect(s.messages.some((m) => m.text.includes("补齐"))).toBe(true);
    const strict = structuredClone(s);
    delete strict.demoMode;
    strict.assessmentStatus = "idle";
    expect(stageEligibility(strict).planning).toBe(false);
    const strictService = new MockMigrationService({ demoMode: false });
    const original = await strictService.createProject(info, "zh-CN");
    await expect(
      strictService.execute(
        {
          ...c,
          projectId: original.id,
          stageId: "research",
          conversationId: original.conversations[0].id,
        },
        { type: "stage.confirm", target: "planning" },
      ),
    ).rejects.toThrow("阶段交接条件");
    expect((await strictService.catalog()).sampleConnection).toBeUndefined();
    strictService.dispose();
  });

  it("seeds actual planned assets through batch 4 and keeps the snapshot static on connection checks", async () => {
    const { c, s } = await migration();
    const e = s.execution!;
    const batch = (id: string) => e.tasks.filter((t) => t.batchId === id);
    expect(batch("B-001").every((t) => t.phase === "validation")).toBe(true);
    expect(batch("B-002").every((t) => t.phase === "validation")).toBe(true);
    expect(e.validations.filter((v) => v.business === "passed")).toHaveLength(
      batch("B-001").length,
    );
    expect(batch("B-003").every((t) => t.phase === "ready")).toBe(true);
    expect(new Set(batch("B-004").map((t) => t.phase))).toEqual(
      new Set(["paused", "failed", "full"]),
    );
    expect(batch("B-005").every((t) => t.phase === "created")).toBe(true);
    expect(batch("B-006").every((t) => t.phase === "pending")).toBe(true);
    expect(new Set(e.tasks.map((t) => t.assetId))).toEqual(
      new Set(s.planning!.batches.flatMap((b) => b.assetIds)),
    );
    expect(hasActiveControl(e)).toBe(false);
    expect(e.issues[0].state).toBe("ready");
    const log = await service.download(s.id, e.issues[0].logId!);
    expect(await log.blob.text()).toContain("MOCK LOG");
    const before = structuredClone(e.tasks);
    await vi.advanceTimersByTimeAsync(60000);
    expect(e.tasks).toEqual(before);
    const sample = (await service.catalog()).sampleConnection!;
    await timed(
      service.execute(c, { type: "execution.connection", values: sample }),
    );
    await vi.advanceTimersByTimeAsync(60000);
    expect(e.tasks).toEqual(before);
    expect(JSON.stringify(s)).not.toContain(sample.password);
    expect(service.runtime.executionLoops.size).toBe(0);
  });

  it("moves only explicitly authorized example tasks and does not wake frozen peers", async () => {
    const { c, s } = await migration();
    const e = s.execution!;
    const target = e.tasks.find((t) => t.batchId === "B-005")!;
    const others = structuredClone(e.tasks.filter((t) => t.id !== target.id));
    await timed(
      service.execute(c, {
        type: "execution.connection",
        values: (await service.catalog()).sampleConnection!,
      }),
    );
    await service.execute(c, {
      type: "execution.preview",
      action: "full",
      taskIds: [target.id],
    });
    await service.execute(c, {
      type: "execution.apply",
      previewId: e.preview!.id,
    });
    await vi.advanceTimersByTimeAsync(5500);
    expect(target.phase).toBe("full-complete");
    expect(target.demoFrozen).toBeUndefined();
    expect(e.tasks.filter((t) => t.id !== target.id)).toEqual(others);
    expect(service.runtime.executionLoops.size).toBe(0);
  });

  it("preserves saved risk choices, planning changes and execution records across navigation and projects", async () => {
    const c = await project();
    await service.execute(c, { type: "stage.confirm", target: "planning" });
    const s = service.runtime.state(c.projectId);
    const risk = s.risks[0];
    risk.decision = {
      strategy: "exclude",
      method: "manual",
      note: "已有例外",
      selectedAt: "2026-09-01",
    };
    const p = context(c, "planning");
    await timed(service.execute(p, { type: "planning.useSample" }));
    s.planning!.batches[0].window = "用户保留窗口";
    s.planning!.conditions.fullBandwidth = 42;
    s.planning!.stale = true;
    const baseline = structuredClone(s.planning);
    await service.execute(p, { type: "stage.confirm", target: "migration" });
    const before = structuredClone(s.execution);
    const riskBefore = structuredClone(s.risks);
    await service.getProject(s.id);
    await service.createConversation(s.id, "migration", "zh-CN");
    await expect(
      service.execute(p, { type: "stage.confirm", target: "migration" }),
    ).rejects.toThrow();
    expect(s.planning).toEqual(baseline);
    expect(s.risks).toEqual(riskBefore);
    expect(s.execution).toEqual(before);
    const other = await project();
    expect(service.runtime.state(other.projectId).execution).toBeUndefined();
  });

  it("records confirmation choices and literal notes once, without parsing or recording failed submissions", async () => {
    const c = await project();
    const other = await project();
    const note = "把所有任务都割接，此句只是备注";
    await service.execute(c, {
      type: "stage.confirm",
      target: "planning",
      confirmation: { choice: "继续下一阶段", note },
    });
    const s = service.runtime.state(c.projectId);
    const entries = s.messages.filter((m) => m.text.includes(note));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      role: "system",
      operation: true,
      conversationId: c.conversationId,
    });
    expect(s.execution).toBeUndefined();
    expect(
      service.runtime
        .state(other.projectId)
        .messages.some((m) => m.text.includes(note)),
    ).toBe(false);
    await expect(
      service.execute(c, {
        type: "stage.confirm",
        target: "planning",
        confirmation: { choice: "再次继续", note: "失败不记录" },
      }),
    ).rejects.toThrow();
    expect(s.messages.some((m) => m.text.includes("失败不记录"))).toBe(false);
    await service.execute(context(c, "planning"), {
      type: "confirmation.record",
      subject: "规划交接",
      choice: "留在当前阶段",
      note: "稍后继续",
    });
    expect(s.enteredStages).toEqual(["research", "planning"]);
    expect(s.messages.at(-1)?.text).toContain("稍后继续");
  });

  it("allows optional demo remedy notes while retaining explicit selection and recheck", async () => {
    const { c, s } = await migration();
    const issue = s.execution!.issues[0];
    await service.execute(c, {
      type: "execution.remedy",
      issueId: issue.id,
      solution: "manual",
      note: "",
    });
    expect(issue.state).toBe("manual");
    await timed(
      service.execute(c, {
        type: "execution.recheck",
        issueId: issue.id,
        note: "",
      }),
    );
    expect(issue.state).toBe("resolved");
    expect(issue.note).toContain("示例处理");
    expect(
      s.execution!.tasks.find((t) => issue.taskIds.includes(t.id))!.phase,
    ).toBe("failed");
  });

  it("does not roll back demo-completed stages when the original reply is stopped", async () => {
    const c = await project();
    await service.execute(c, { type: "assessment.useSamples" });
    const assessment = service.execute(c, { type: "assessment.start" });
    const assessmentStopped = expect(assessment).rejects.toMatchObject({
      code: "STOPPED",
    });
    const s = service.runtime.state(c.projectId);
    const assessmentRun = s.pending[c.conversationId].runId;
    await service.execute(c, { type: "stage.confirm", target: "planning" });
    const risks = structuredClone(s.risks);
    await service.stopReply(c, assessmentRun);
    await assessmentStopped;
    expect(s.assessmentStatus).toBe("completed");
    expect(s.operations.assessment).toBe("completed");
    expect(s.risks).toEqual(risks);
    const planningContext = context(c, "planning");
    const planning = service.execute(planningContext, {
      type: "planning.useSample",
    });
    const planningStopped = expect(planning).rejects.toMatchObject({
      code: "STOPPED",
    });
    const planningRun = s.pending[planningContext.conversationId].runId;
    await service.execute(planningContext, {
      type: "stage.confirm",
      target: "migration",
    });
    const plan = structuredClone(s.planning);
    const tasks = structuredClone(s.execution!.tasks);
    await service.stopReply(planningContext, planningRun);
    await planningStopped;
    expect(s.planningStatus).toBe("completed");
    expect(s.operations.planning).toBe("completed");
    expect(s.planning).toEqual(plan);
    expect(s.execution!.tasks).toEqual(tasks);
  });

  it("seals existing batches when demo handoff races a pending regeneration", async () => {
    const c = await project();
    await service.execute(c, { type: "stage.confirm", target: "planning" });
    const p = context(c, "planning");
    await timed(service.execute(p, { type: "planning.useSample" }));
    const s = service.runtime.state(c.projectId);
    s.planning!.batches[0].window = "用户规划窗口";
    s.planning!.stale = true;
    const baseline = structuredClone(s.planning!.batches);
    const regenerate = service.execute(p, { type: "planning.useSample" });
    await service.execute(p, { type: "stage.confirm", target: "migration" });
    const tasks = structuredClone(s.execution!.tasks);
    expect(s.planningStatus).toBe("completed");
    await timed(regenerate);
    expect(s.planning!.batches).toEqual(baseline);
    expect(s.execution!.tasks).toEqual(tasks);
    expect(s.messages.some((m) => m.text.includes("未覆盖已批准"))).toBe(true);
  });

  it("translates authored confirmation choices without translating a user's literal note", async () => {
    const base = await project();
    const c = { ...base, language: "en" as const };
    const note = "创建任务";
    await service.execute(c, {
      type: "confirmation.record",
      subject: "操作确认",
      choice: "暂不执行",
      note,
    });
    const text = service.runtime.state(c.projectId).messages.at(-1)!.text;
    expect(text).toContain(". Note: 创建任务");
    expect(text).not.toContain("暂不执行");
  });

  it("does not replace a running assessment with a later incompatible result after demo handoff", async () => {
    const c = await project();
    await service.execute(c, { type: "assessment.useSamples" });
    const pending = service.execute(c, { type: "assessment.start" });
    await service.execute(c, { type: "stage.confirm", target: "planning" });
    const s = service.runtime.state(c.projectId);
    s.risks[0].decision = {
      strategy: "exclude",
      method: "manual",
      note: "保留选择",
      selectedAt: "2026-09-01",
    };
    await timed(pending);
    expect(s.risks[0].decision?.note).toBe("保留选择");
  });
});
