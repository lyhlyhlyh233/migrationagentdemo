import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutionWorkspace } from "@/features/migration/ExecutionWorkspace";
import { initialExecutionView } from "@/features/migration/state";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { MockMigrationService } from "../mock";
import type { OperationContext } from "@/domain/models";
import type { ExecutionAction } from "@/domain/execution";
import { canValidate, executionBlock } from "@/domain/execution";
let service: MockMigrationService;
beforeEach(() => {
  vi.useFakeTimers();
  service = new MockMigrationService();
});
afterEach(() => {
  service.dispose();
  vi.useRealTimers();
});
async function timed<T>(promise: Promise<T>, ms = 3000) {
  const captured = promise.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await vi.advanceTimersByTimeAsync(ms);
  const result = await captured;
  if ("error" in result) throw result.error;
  return result.value;
}
async function setup(language: "zh-CN" | "en" = "zh-CN") {
  const s = await service.createProject(
    {
      industry: "IT",
      region: "CN",
      office: "office",
      siteName: "Execution test",
      migrationType: "vm",
    },
    language,
  );
  await vi.advanceTimersByTimeAsync(2000);
  const c: OperationContext = {
    projectId: s.id,
    conversationId: s.conversations[0].id,
    stageId: "research",
    language,
  };
  await service.execute(c, { type: "assessment.useSamples" });
  const assess = service.execute(c, { type: "assessment.start" });
  await vi.runAllTimersAsync();
  await assess;
  await service.execute(c, { type: "stage.confirm", target: "planning" });
  c.stageId = "planning";
  c.conversationId = "stage-planning-main";
  const plan = service.execute(c, { type: "planning.useSample" });
  await vi.runAllTimersAsync();
  await plan;
  await service.execute(c, { type: "stage.confirm", target: "migration" });
  c.stageId = "migration";
  c.conversationId = "stage-migration-main";
  return { c, s: service.runtime.state(s.id) };
}
const connection = {
  type: "execution.connection" as const,
  values: {
    ip: "192.0.2.10",
    port: 443,
    username: "tester",
    password: "NeverIncludeSecret",
  },
};
async function act(
  c: OperationContext,
  action: ExecutionAction,
  taskIds: string[],
  extra: Record<string, unknown> = {},
) {
  await service.execute(c, {
    type: "execution.preview",
    action,
    taskIds,
    computeResource: "pool",
    network: "net",
    ...extra,
  });
  await service.execute(c, {
    type: "execution.apply",
    previewId: service.runtime.state(c.projectId).execution!.preview!.id,
  });
}
async function cutover() {
  const x = await setup();
  await timed(service.execute(x.c, connection));
  const ids = x.s.execution!.tasks.slice(0, 3).map((t) => t.id);
  await act(x.c, "start", ids);
  await vi.advanceTimersByTimeAsync(8000);
  await act(x.c, "cutover", ids);
  await vi.advanceTimersByTimeAsync(2500);
  await service.execute(x.c, { type: "stage.confirm", target: "validation" });
  return {
    ...x,
    ids,
    v: {
      ...x.c,
      stageId: "validation" as const,
      conversationId: "stage-validation-main",
    },
  };
}
describe("batch execution and business validation", () => {
  it("inherits the complete eligible scope; connection failures preserve effective settings without leaking credentials", async () => {
    const { c, s } = await setup();
    expect(s.execution!.tasks).toHaveLength(186);
    expect(new Set(s.execution!.tasks.map((t) => t.assetId)).size).toBe(186);
    await timed(service.execute(c, connection));
    const old = { ...s.execution!.connection };
    await expect(
      timed(
        service.execute(c, {
          ...connection,
          simulateFailure: true,
          values: { ...connection.values, ip: "192.0.2.11" },
        }),
      ),
    ).rejects.toThrow("模拟连接失败");
    expect(s.execution!.connection).toEqual(old);
    expect(s.execution!.connectionStatus).toBe("ready");
    expect(JSON.stringify(await service.getProject(s.id))).not.toContain(
      "NeverIncludeSecret",
    );
    await expect(
      service.execute(c, {
        ...connection,
        values: { ...connection.values, port: 0 },
      }),
    ).rejects.toThrow();
  });
  it("requires explicit previews and serial prerequisites; moving pending tasks preserves the approved plan", async () => {
    const { c, s } = await setup(),
      e = s.execution!,
      id = e.tasks[0].id,
      baseline = structuredClone(s.planning!.batches);
    expect(executionBlock(s, e.tasks[0], "start")).toBeTruthy();
    await timed(service.execute(c, connection));
    await act(c, "move", [id], { targetBatchId: s.planning!.batches[1].id });
    expect(s.planning!.batches).toEqual(baseline);
    await act(c, "start", [id]);
    await expect(act(c, "cutover", [id])).rejects.toThrow();
    await expect(
      act(c, "move", [id], { targetBatchId: s.planning!.batches[0].id }),
    ).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(2000);
    await act(c, "pause", [id]);
    const progress = e.tasks[0].progress;
    await vi.advanceTimersByTimeAsync(2000);
    expect(e.tasks[0].progress).toBe(progress);
    await act(c, "resume", [id]);
    await vi.advanceTimersByTimeAsync(8000);
    expect(e.tasks[0].phase).toBe("ready");
    expect(e.validations).toHaveLength(0);
    await act(c, "increment", [id]);
    await expect(act(c, "increment", [id])).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(2500);
    expect(e.tasks[0].lastSync).toBeTruthy();
  });
  it("diagnoses a network issue once, requires approval and does not resume a repaired task automatically", async () => {
    const { c, s } = await setup(),
      e = s.execution!;
    await timed(service.execute(c, connection));
    const ids = e.tasks.slice(0, 2).map((t) => t.id);
    await act(c, "start", ids, { scenario: "network" });
    await vi.advanceTimersByTimeAsync(3500);
    expect(e.issues).toHaveLength(1);
    const issue = e.issues[0];
    expect(issue.state).toBe("ready");
    expect(e.tasks[0].phase).toBe("failed");
    expect(e.tasks[1].phase).not.toBe("failed");
    const file = await service.download(s.id, issue.logId!);
    expect(await file.blob.text()).toContain("MOCK LOG");
    expect(await file.blob.text()).not.toContain("NeverIncludeSecret");
    await expect(act(c, "retry", [ids[0]])).rejects.toThrow();
    await expect(
      timed(
        service.execute(c, {
          type: "execution.remedy",
          issueId: issue.id,
          solution: "automatic",
          note: "",
          simulateFailure: true,
        }),
      ),
    ).rejects.toThrow();
    expect(issue.state).toBe("repair-failed");
    await timed(
      service.execute(c, {
        type: "execution.remedy",
        issueId: issue.id,
        solution: "automatic",
        note: "",
      }),
    );
    expect(issue.state).toBe("resolved");
    expect(e.tasks[0].phase).toBe("failed");
    await act(c, "retry", [ids[0]]);
    await vi.advanceTimersByTimeAsync(8000);
    expect(e.tasks[0].phase).toBe("ready");
    expect(e.issues).toHaveLength(1);
  });
  it("supports log failure, inconclusive diagnosis, manual evidence and isolated attachment downloads", async () => {
    const { c, s } = await setup(),
      e = s.execution!;
    await timed(service.execute(c, connection));
    await act(c, "start", [e.tasks[0].id], { scenario: "capacity" });
    await vi.advanceTimersByTimeAsync(3500);
    const issue = e.issues[0];
    await timed(
      service.execute(c, {
        type: "execution.diagnose",
        issueId: issue.id,
        simulate: "log-failed",
      }),
    );
    expect(issue.state).toBe("log-failed");
    await timed(
      service.execute(c, {
        type: "execution.diagnose",
        issueId: issue.id,
        simulate: "inconclusive",
      }),
    );
    expect(issue.state).toBe("inconclusive");
    await expect(
      service.execute(c, {
        type: "execution.remedy",
        issueId: issue.id,
        solution: "manual",
        note: "",
      }),
    ).rejects.toThrow();
    await timed(
      service.execute(c, { type: "execution.diagnose", issueId: issue.id }),
    );
    await expect(
      service.execute(c, {
        type: "execution.remedy",
        issueId: issue.id,
        solution: "automatic",
        note: "",
      }),
    ).rejects.toThrow();
    await service.execute(c, {
      type: "execution.remedy",
      issueId: issue.id,
      solution: "manual",
      note: "",
    });
    await service.upload(
      c,
      `issue:${issue.id}`,
      new File(["capacity extended"], "evidence.txt", { type: "text/plain" }),
    );
    expect(
      await (await service.download(s.id, issue.attachments[0])).blob.text(),
    ).toBe("capacity extended");
    const other = await setup();
    await expect(
      service.download(other.s.id, issue.attachments[0]),
    ).rejects.toThrow();
    await timed(
      service.execute(c, {
        type: "execution.recheck",
        issueId: issue.id,
        note: "目标容量已经扩容并核验",
      }),
    );
    expect(issue.state).toBe("resolved");
  });
  it("keeps preview ownership, stale protection and background event origins across conversations", async () => {
    const { c, s } = await setup(),
      e = s.execution!;
    await timed(service.execute(c, connection));
    const child = await service.createConversation(s.id, "migration", "zh-CN"),
      other = { ...c, conversationId: child.id };
    const ids = [e.tasks[0].id];
    await service.execute(c, {
      type: "execution.preview",
      action: "start",
      taskIds: ids,
      computeResource: "pool",
      network: "net",
    });
    const pid = e.preview!.id;
    await expect(
      service.execute(other, { type: "execution.apply", previewId: pid }),
    ).rejects.toThrow();
    await timed(service.execute(other, connection));
    await expect(
      service.execute(c, { type: "execution.apply", previewId: pid }),
    ).rejects.toThrow("状态已变化");
    await service.execute(c, { type: "execution.cancel", previewId: pid });
    await act(c, "start", ids);
    await vi.advanceTimersByTimeAsync(8000);
    const milestone = s.messages.filter((m) =>
      m.text.includes("全量与增量同步已完成"),
    );
    expect(milestone).toHaveLength(1);
    expect(milestone[0].conversationId).toBe(c.conversationId);
  });
  it("requires technical acceptance before business confirmation and preserves batch validation during continued execution", async () => {
    const { s, ids, v, c } = await cutover(),
      e = s.execution!;
    expect(e.validations).toHaveLength(3);
    expect(e.validations[0].technical).toBe("different");
    await expect(
      service.execute(v, {
        type: "validation.record",
        taskIds: ids,
        status: "passed",
        note: "",
      }),
    ).rejects.toThrow();
    expect(e.validations.every((x) => x.business === "pending")).toBe(true);
    await service.execute(v, {
      type: "validation.acceptDifference",
      taskIds: [ids[0]],
      note: "网络映射为已批准的预期变更",
    });
    await service.execute(v, {
      type: "validation.record",
      taskIds: ids.slice(0, 2),
      status: "passed",
      note: "应用接口及登录验证正常",
    });
    expect(e.validations.filter((x) => x.business === "passed")).toHaveLength(
      2,
    );
    expect(e.validations[2].business).toBe("pending");
    await act(c, "start", [e.tasks[10].id]);
    expect(e.validations[0].business).toBe("passed");
    expect(s.enteredStages).toContain("validation");
    await expect(
      service.execute(v, { type: "validation.finalize" }),
    ).rejects.toThrow();
    const report = await service.download(s.id, "validation-report");
    expect(await report.blob.text()).toContain("阶段性结果");
  });
  it("records blocking feedback, rechecks without auto-passing, and retains actual attachment bytes", async () => {
    const { s, ids, v } = await cutover(),
      e = s.execution!;
    await service.execute(v, {
      type: "validation.feedback",
      taskIds: [ids[1]],
      description: "登录失败，需要检查网络映射",
      blocking: true,
    });
    const f = e.feedback[0];
    expect(e.validations[1].business).toBe("failed");
    expect(canValidate(e, e.validations[1])).toBe(false);
    await service.upload(
      v,
      `feedback:${f.id}`,
      new File(["image-bytes"], "capture.png", { type: "image/png" }),
    );
    expect(
      await (await service.download(s.id, f.attachments[0])).blob.text(),
    ).toBe("image-bytes");
    await expect(
      service.execute(v, {
        type: "validation.feedbackReview",
        feedbackId: f.id,
        resolution: "问题已经处理完成",
        confirm: true,
      }),
    ).rejects.toThrow();
    await service.execute(v, {
      type: "validation.feedbackReview",
      feedbackId: f.id,
      resolution: "已修复网络映射，等待复查",
    });
    await service.execute(v, {
      type: "validation.feedbackReview",
      feedbackId: f.id,
      resolution: "已人工确认复查结果正常",
      confirm: true,
    });
    expect(e.validations[1].business).toBe("pending");
  });
  it("blocks new controls on permission failures until reconnect, manual review and explicit retry", async () => {
    const { c, s } = await setup(),
      e = s.execution!;
    await timed(service.execute(c, connection));
    await act(
      c,
      "start",
      e.tasks.slice(0, 2).map((t) => t.id),
      { scenario: "permission" },
    );
    await vi.advanceTimersByTimeAsync(3500);
    expect(e.connectionStatus).toBe("failed");
    expect(e.tasks[1].created).toBe(false);
    await expect(act(c, "start", [e.tasks[2].id])).rejects.toThrow();
    await expect(
      timed(service.execute(c, { ...connection, simulateFailure: true })),
    ).rejects.toThrow();
    expect(e.connectionStatus).toBe("failed");
    const issue = e.issues[0];
    await service.execute(c, {
      type: "execution.remedy",
      issueId: issue.id,
      solution: "manual",
      note: "权限已修复",
    });
    await expect(
      service.execute(c, {
        type: "execution.recheck",
        issueId: issue.id,
        note: "已核验账号权限",
      }),
    ).rejects.toThrow();
    await timed(service.execute(c, connection));
    await timed(
      service.execute(c, {
        type: "execution.recheck",
        issueId: issue.id,
        note: "已核验账号权限",
      }),
    );
    expect(e.tasks[0].phase).toBe("failed");
    await act(c, "retry", [e.tasks[0].id]);
    await vi.advanceTimersByTimeAsync(8000);
    expect(e.tasks[0].phase).toBe("ready");
  });
  it("rejects stale validation edits without losing the current confirmation", async () => {
    const { s, ids, v } = await cutover(),
      e = s.execution!,
      revision = e.revision;
    await service.execute(v, {
      type: "validation.record",
      taskIds: [ids[1]],
      status: "passed",
      note: "检查完成",
      expectedRevision: revision,
    });
    await expect(
      service.execute(v, {
        type: "validation.record",
        taskIds: [ids[1]],
        status: "failed",
        note: "另一会话的旧说明",
        expectedRevision: revision,
      }),
    ).rejects.toThrow("验证状态已更新");
    expect(e.validations[1].business).toBe("passed");
    expect(e.validations[1].configuration.map((c) => c.field)).toContain(
      "vCPU",
    );
  });
  it("keeps conversational execution as an uncommitted preview and clarifies unspecified requests", async () => {
    const { c, s } = await setup(),
      e = s.execution!;
    await timed(service.execute(c, connection));
    await timed(
      service.sendMessage(c, {
        text: "启动批次",
        context: e.tasks[0].batchId,
        agentId: "migration",
        modelId: "glm-5.1",
        requestId: "start-discussion",
      }),
    );
    expect(e.preview?.action).toBe("start");
    expect(e.tasks.every((t) => t.phase === "pending")).toBe(true);
    await service.execute(c, {
      type: "execution.cancel",
      previewId: e.preview!.id,
    });
    await timed(
      service.sendMessage(c, {
        text: "把所有内容智能优化一下",
        agentId: "migration",
        modelId: "glm-5.1",
        requestId: "clarify-discussion",
      }),
    );
    expect(e.preview).toBeUndefined();
    expect(e.tasks.every((t) => t.phase === "pending")).toBe(true);
  });
  it("limits active work by concurrency and allows final delivery only after the complete eligible scope is validated", async () => {
    const { c, s } = await setup(),
      e = s.execution!;
    await timed(service.execute(c, connection));
    const ids = e.tasks.map((t) => t.id),
      cap = s.planning!.conditions.concurrency;
    await act(c, "start", ids);
    await vi.advanceTimersByTimeAsync(1100);
    expect(e.tasks.filter((t) => t.created)).toHaveLength(cap);
    await vi.advanceTimersByTimeAsync(1000 * Math.ceil(ids.length / cap) * 8);
    expect(e.tasks.every((t) => t.phase === "ready")).toBe(true);
    await act(c, "cutover", ids);
    await vi.advanceTimersByTimeAsync(1000 * Math.ceil(ids.length / cap) * 3);
    expect(new Set(e.validations.map((v) => v.taskId)).size).toBe(ids.length);
    await service.execute(c, { type: "stage.confirm", target: "validation" });
    const v = {
      ...c,
      stageId: "validation" as const,
      conversationId: "stage-validation-main",
    };
    await service.execute(v, {
      type: "validation.acceptDifference",
      taskIds: e.validations
        .filter((v) => v.technical === "different")
        .map((v) => v.taskId),
      note: "已核对为批准的网络变更",
    });
    await service.execute(v, {
      type: "validation.record",
      taskIds: ids,
      status: "passed",
      note: "批量业务验证已完成",
    });
    await service.execute(v, { type: "validation.finalize" });
    expect(e.finalized).toBe(true);
    expect(
      await (await service.download(s.id, "validation-report")).blob.text(),
    ).toContain("最终交付已确认");
    await expect(
      act(c, "window", [ids[0]], { window: "周日" }),
    ).rejects.toThrow();
  });
  it("cancels a connection test without replacing the working configuration", async () => {
    const { c, s } = await setup();
    await timed(service.execute(c, connection));
    const original = { ...s.execution!.connection };
    const controller = new AbortController();
    const pending = service.execute(
      c,
      { ...connection, values: { ...connection.values, ip: "192.0.2.20" } },
      { signal: controller.signal },
    );
    const result = expect(pending).rejects.toMatchObject({ code: "ABORTED" });
    controller.abort();
    await result;
    expect(s.execution!.connection).toEqual(original);
    expect(s.execution!.connectionStatus).toBe("ready");
  });
  it("localizes authored execution guidance and diagnosis", async () => {
    const { c, s } = await setup("en");
    await timed(service.execute(c, connection));
    await act(c, "start", [s.execution!.tasks[0].id], { scenario: "network" });
    await vi.advanceTimersByTimeAsync(4000);
    for (const message of s.messages.filter(
      (m) => m.stageId === "migration" && m.role === "agent",
    )) {
      expect(message.text).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
  it("renders only the selected page for 10,000 task records", async () => {
    const { s } = await setup(),
      snapshot = structuredClone(s),
      base = snapshot.execution!.tasks[0];
    snapshot.execution!.tasks = Array.from({ length: 10000 }, (_, i) => ({
      ...base,
      id: `scale-${i}`,
      name: `scale-vm-${i}`,
    }));
    const html = renderToStaticMarkup(
      createElement(ExecutionWorkspace, {
        snapshot,
        view: { ...initialExecutionView(), tab: "tasks", mode: "vms" },
        onView: () => {},
        onCommand: async () => true,
        onDownload: () => {},
        onUpload: async () => true,
        conversationId: null,
      }),
    );
    expect(html.match(/<tr/g) || []).toHaveLength(21);
    expect(html).toContain("scale-vm-19");
    expect(html).not.toContain("scale-vm-20");
  });
  it("cleans timers, requests and attachment state at logout without late events", async () => {
    const { c, s } = await setup();
    await timed(service.execute(c, connection));
    await act(c, "start", [s.execution!.tasks[0].id]);
    const listener = vi.fn();
    service.subscribe(listener);
    await service.logout();
    listener.mockClear();
    await vi.advanceTimersByTimeAsync(15000);
    expect(listener).not.toHaveBeenCalled();
    expect(service.runtime.executionLoops.size).toBe(0);
    expect(service.runtime.attachments.size).toBe(0);
  });
});
