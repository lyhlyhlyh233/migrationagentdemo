import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockMigrationService } from "../mock";
import { migrationScope } from "@/domain/assessment";
import {
  planningIsStale,
  planningSummary,
  planningWarnings,
} from "@/domain/planning";
import { stageEligibility } from "@/domain/policies";
import { planningFiles } from "../mock/planning-files";
let service: MockMigrationService;
beforeEach(() => {
  vi.useFakeTimers();
  service = new MockMigrationService();
});
afterEach(() => {
  service.dispose();
  vi.useRealTimers();
});
async function settle(p: Promise<unknown>) {
  await vi.runAllTimersAsync();
  return p;
}
async function setup(language: "zh-CN" | "en" = "zh-CN") {
  const s = await service.createProject(
    {
      industry: "金融",
      region: "中国",
      office: "上海",
      siteName: "规划检查",
      migrationType: "虚拟化",
    },
    language,
  );
  await vi.runAllTimersAsync();
  const c = {
    projectId: s.id,
    conversationId: s.conversations[0].id,
    stageId: "research" as const,
    language,
  };
  await service.execute(c, { type: "assessment.useSamples" });
  await settle(service.execute(c, { type: "assessment.start" }));
  await service.execute(c, { type: "stage.confirm", target: "planning" });
  const state = service.runtime.state(s.id);
  return {
    c: {
      ...c,
      stageId: "planning" as const,
      conversationId: state.conversations.find((v) => v.stageId === "planning")!
        .id,
    },
    state,
  };
}
describe("planning workspace service", () => {
  it("localizes authored planning guidance and generated results", async () => {
    const { c, state } = await setup("en");
    await settle(service.execute(c, { type: "planning.useSample" }));
    const replies = state.messages.filter(
      (m) => m.stageId === "planning" && m.role === "agent",
    );
    expect(replies.length).toBeGreaterThanOrEqual(2);
    for (const reply of replies) {
      expect(reply.text).not.toMatch(/[\u4e00-\u9fff]/);
      expect(reply.reply?.summary).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
  it("preserves each filled business field during sample import", async () => {
    const { c, state } = await setup();
    await service.execute(c, {
      type: "planning.save",
      expectedRevision: 0,
      patch: {
        attributes: {
          assetIds: [state.planning!.assets[0].id],
          values: { grade: "critical", clusterRole: "主节点" },
        },
      },
    });
    await service.execute(c, {
      type: "planning.preview",
      expectedRevision: 1,
      change: { kind: "import", filename: "input.xlsx" },
    });
    await service.execute(c, {
      type: "planning.apply",
      previewId: state.planning!.preview!.id,
    });
    expect(state.planning!.assets[0]).toMatchObject({
      grade: "critical",
      clusterRole: "主节点",
    });
    expect(state.planning!.assets[0].system).toBeTruthy();
    await settle(service.execute(c, { type: "planning.useSample" }));
    expect(state.planning!.batches[0].assetIds).not.toContain(
      state.planning!.assets[0].id,
    );
  });

  it("inherits current assessment data, starts one contextual conversation and accepts missing business information", async () => {
    const { c, state } = await setup();
    expect(state.planning!.assets.length).toBe(200);
    expect(state.planning!.baselineEligibleIds.length).toBe(186);
    expect(
      state.messages.filter((m) => m.text === "开始迁移项目的规划设计"),
    ).toHaveLength(1);
    expect(state.messages.at(-1)?.conversationId).toBe(c.conversationId);
    await settle(service.execute(c, { type: "planning.useSample" }));
    expect(planningSummary(state.planning!)).toMatchObject({
      included: 186,
      excluded: 14,
      missing: 186,
    });
    expect(planningWarnings(state.planning!)).toContain("业务依赖待核对");
    expect(stageEligibility(state).migration).toBe(true);
    expect(state.planning!.batches).toHaveLength(8);
    const ids = state.planning!.batches.flatMap((b) => b.assetIds);
    expect(new Set(ids).size).toBe(186);
    expect(new Set(state.batchTasks.flatMap((b) => b.vmNames))).toEqual(
      new Set(migrationScope(state).map((row) => row[0])),
    );
  });
  it("preserves inputs and existing assignments until explicit regeneration, then updates files", async () => {
    const { c, state } = await setup();
    await settle(service.execute(c, { type: "planning.useSample" }));
    const original = structuredClone(state.planning!.batches);
    await service.execute(c, {
      type: "planning.save",
      expectedRevision: state.planning!.revision,
      patch: {
        conditions: { ...state.planning!.conditions, fullBandwidth: 1 },
      },
    });
    expect(state.planning!.batches).toEqual(original);
    expect(planningIsStale(state)).toBe(true);
    expect(stageEligibility(state).migration).toBe(false);
    await settle(service.execute(c, { type: "planning.useSample" }));
    expect(planningIsStale(state)).toBe(false);
    expect(planningWarnings(state.planning!)).toContain(
      "同步带宽较低，需重新估算同步时长",
    );
    const file = await service.download(state.id, "batch-plan");
    const text = await file.blob.text();
    for (const name of [
      "批次规划",
      "批次计划",
      "批次详情",
      "资源需求",
      "迁移时间线",
    ])
      expect(text).toContain(`ss:Name="${name}"`);
    expect(text).toContain('ss:StyleID="sync"');
    expect(text).toContain("模拟估算");
    expect(text).toContain("售后输入批次VM数");
    expect(text).toContain("集群类型");
    const template = await (
      await service.download(state.id, "planning-template")
    ).blob.text();
    for (const label of [
      "虚拟机评估总览",
      "业务系统名称",
      "集群角色",
      "上游系统(被依赖方)",
      "依赖强度",
      "单批次最大并发迁移数",
    ])
      expect(template).toContain(label);
  });
  it("keeps preview isolated, cancels without changing assignments, applies moves once without duplicate VMs", async () => {
    const { c, state } = await setup();
    await settle(service.execute(c, { type: "planning.useSample" }));
    const p = state.planning!;
    const before = structuredClone(p.batches);
    const target = p.batches[1].id;
    const ids = p.batches[0].assetIds.slice(0, 2);
    await service.execute(c, {
      type: "planning.preview",
      expectedRevision: p.revision,
      change: { kind: "move", assetIds: ids, targetBatchId: target },
    });
    expect(p.batches).toEqual(before);
    await service.execute(c, {
      type: "planning.cancel",
      previewId: p.preview!.id,
    });
    expect(p.batches).toEqual(before);
    await service.execute(c, {
      type: "planning.preview",
      expectedRevision: p.revision,
      change: { kind: "move", assetIds: ids, targetBatchId: target },
    });
    const previewId = p.preview!.id;
    await service.execute(c, { type: "planning.apply", previewId });
    expect(p.batches[1].assetIds).toEqual(expect.arrayContaining(ids));
    expect(new Set(p.batches.flatMap((b) => b.assetIds)).size).toBe(186);
    expect(
      state.vmTasks
        .filter((v) => ids.includes(v.id))
        .every((v) => v.batchId === target),
    ).toBe(true);
    await expect(
      service.execute(c, { type: "planning.apply", previewId }),
    ).rejects.toThrow("预览已失效");
  });
  it("blocks stale and other-session updates, retains failed preview, then permits cancellation", async () => {
    const { c, state } = await setup();
    await settle(service.execute(c, { type: "planning.useSample" }));
    const p = state.planning!;
    const child = await service.createConversation(
      state.id,
      "planning",
      "zh-CN",
    );
    const other = { ...c, conversationId: child.id };
    const old = p.revision;
    await service.execute(c, {
      type: "planning.save",
      expectedRevision: old,
      patch: { capacity: { ...p.capacity, cpu: 2000 } },
    });
    await expect(
      service.execute(other, {
        type: "planning.save",
        expectedRevision: old,
        patch: { capacity: { ...p.capacity, cpu: 3000 } },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(p.capacity.cpu).toBe(2000);
    await service.execute(c, {
      type: "planning.preview",
      expectedRevision: p.revision,
      change: { kind: "conditions", values: { concurrency: 10 } },
    });
    const previewId = p.preview!.id;
    await expect(
      service.execute(other, { type: "planning.apply", previewId }),
    ).rejects.toThrow("发起调整");
    p.revision++;
    await expect(
      service.execute(c, { type: "planning.apply", previewId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(p.preview?.id).toBe(previewId);
    expect(p.conditions.concurrency).toBe(20);
    await service.execute(c, { type: "planning.cancel", previewId });
    expect(p.preview).toBeUndefined();
  });
  it("uploads only create an explicitly simulated preview and preserve existing per-VM metadata", async () => {
    const { c, state } = await setup();
    const p = state.planning!;
    await service.execute(c, {
      type: "planning.save",
      expectedRevision: p.revision,
      patch: {
        attributes: {
          assetIds: [p.assets[0].id],
          values: { system: "用户的系统", grade: "critical" },
        },
      },
    });
    await service.upload(
      c,
      "planning",
      new File(["not a real workbook"], "客户计划.xlsx"),
    );
    expect(p.assets[1].system).toBe("");
    expect(state.messages.at(-1)?.text).toContain("尚未读取实际表格内容");
    await service.execute(c, {
      type: "planning.apply",
      previewId: p.preview!.id,
    });
    expect(p.assets[0].system).toBe("用户的系统");
    expect(p.assets[0].grade).toBe("critical");
    expect(p.assets[1].system).not.toBe("");
    expect(state.planningStatus).not.toBe("completed");
    await expect(
      service.upload(c, "planning", new File(["x"], "bad.exe")),
    ).rejects.toThrow();
  });
  it("rejects invalid input atomically and makes confirmed planning read-only", async () => {
    const { c, state } = await setup();
    const p = state.planning!;
    const before = structuredClone(p);
    await expect(
      service.execute(c, {
        type: "planning.save",
        expectedRevision: p.revision,
        patch: {
          conditions: { ...p.conditions, fullBandwidth: 0 },
          attributes: {
            assetIds: [p.assets[0].id],
            values: { system: "do not save" },
          },
        },
      }),
    ).rejects.toThrow();
    expect(p).toEqual(before);
    await settle(service.execute(c, { type: "planning.useSample" }));
    await service.execute(c, { type: "stage.confirm", target: "migration" });
    await expect(
      service.execute(c, {
        type: "planning.save",
        expectedRevision: p.revision,
        patch: { capacity: p.capacity },
      }),
    ).rejects.toThrow("只读");
  });
  it("detects later risk changes and never adds newly excluded VMs on regeneration", async () => {
    const { c, state } = await setup();
    await settle(service.execute(c, { type: "planning.useSample" }));
    const risk = state.risks.find((r) => r.impact === "constraint")!;
    await service.execute(c, {
      type: "risk.decide",
      riskIds: [risk.id],
      decision: {
        strategy: "exclude",
        method: "manual",
        note: "本次不迁，保留源端",
      },
    });
    expect(planningIsStale(state)).toBe(true);
    expect(stageEligibility(state).migration).toBe(false);
    await settle(service.execute(c, { type: "planning.useSample" }));
    expect(state.batchTasks.flatMap((b) => b.vmNames)).not.toContain(
      risk.vmName,
    );
  });
  it("keeps asynchronous generation in its initiating chat, isolates projects, and supports cancelled retry", async () => {
    const { c, state } = await setup();
    const second = await setup();
    const child = await service.createConversation(
      state.id,
      "planning",
      "zh-CN",
    );
    const from = { ...c, conversationId: child.id };
    const abort = new AbortController();
    const pending = service.execute(
      from,
      { type: "planning.useSample" },
      { signal: abort.signal },
    );
    const rejection = expect(pending).rejects.toMatchObject({
      code: "ABORTED",
    });
    abort.abort();
    await rejection;
    expect(state.planning!.batches).toEqual([]);
    expect(state.planningStatus).toBe("scope-review");
    await settle(service.execute(from, { type: "planning.useSample" }));
    expect(state.messages.at(-1)?.conversationId).toBe(child.id);
    expect(second.state.planning!.batches).toEqual([]);
  });
  it("supports authored conversation adjustment previews without applying a change on send", async () => {
    const { c, state } = await setup();
    await settle(service.execute(c, { type: "planning.useSample" }));
    const before = state.planning!.batches[1].cutover;
    await settle(
      service.sendMessage(c, {
        text: "将 B02 割接改到周六",
        agentId: "planning",
        modelId: "glm-5.1",
        requestId: "window",
      }),
    );
    expect(state.planning!.batches[1].cutover).toBe(before);
    expect(state.planning!.preview?.change.kind).toBe("window");
    await service.execute(c, {
      type: "planning.apply",
      previewId: state.planning!.preview!.id,
    });
    expect(new Date(state.planning!.batches[1].cutover).getDay()).toBe(6);
  });
  it("covers 10,000 assets and exports without duplicate assignments", async () => {
    const { c, state } = await setup();
    state.scopeRows = Array.from({ length: 10000 }, (_, i) => [
      `large-vm-${i}`,
      "10.0.0.1",
      4,
      16,
      "pool",
    ]);
    state.vmCount = 10000;
    await settle(service.execute(c, { type: "planning.useSample" }));
    const p = state.planning!;
    expect(p.assets).toHaveLength(10000);
    const ids = p.batches.flatMap((b) => b.assetIds);
    expect(ids).toHaveLength(10000);
    expect(new Set(ids).size).toBe(10000);
    expect(planningSummary(p).resources.cpu).toBe(40000);
    planningFiles(service.runtime, state);
    expect(service.runtime.files.get(`${state.id}/batch-plan`)!.body).toContain(
      "large-vm-9999",
    );
  });
});
