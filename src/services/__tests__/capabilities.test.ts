import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationContext } from "@/domain/models";
import type { ProjectCommand } from "../contracts";
import { MockMigrationService } from "../mock";

let service: MockMigrationService;
const info = {
  siteName: "能力边界",
  office: "上海",
  industry: "IT",
  region: "CN",
  migrationType: "vm",
};
beforeEach(() => {
  vi.useFakeTimers();
  service = new MockMigrationService({ demoTools: false });
});
afterEach(() => {
  service.dispose();
  vi.useRealTimers();
});
async function createProject(): Promise<OperationContext> {
  const snapshot = await service.createProject(info, "zh-CN");
  await vi.runAllTimersAsync();
  return {
    projectId: snapshot.id,
    conversationId: snapshot.conversations[0].id,
    stageId: "research",
    language: "zh-CN",
  };
}

describe("explicit demo capabilities", () => {
  it("omits sample credentials and rejects demo commands before changing state", async () => {
    const catalog = await service.catalog();
    expect(catalog.capabilities?.demoTools).toBe(false);
    expect(catalog.sampleConnection).toBeUndefined();
    const c = await createProject();
    const before = await service.getProject(c.projectId);
    const commands: ProjectCommand[] = [
      { type: "assessment.useSamples" },
      { type: "planning.sampleInputs" },
      {
        type: "execution.connection",
        values: {
          ip: "192.0.2.10",
          port: 443,
          username: "demo",
          password: "demo",
        },
        simulateFailure: true,
      },
      {
        type: "execution.preview",
        action: "start",
        taskIds: [],
        scenario: "network",
      },
      {
        type: "execution.preview",
        action: "start",
        taskIds: [],
        scenario: "normal",
      },
      {
        type: "execution.connection",
        values: {
          ip: "192.0.2.10",
          port: 443,
          username: "demo",
          password: "demo",
        },
        simulateFailure: false,
      },
      {
        type: "execution.diagnose",
        issueId: "unknown",
        simulate: "log-failed",
      },
      {
        type: "execution.remedy",
        issueId: "unknown",
        solution: "manual",
        note: "test",
        simulateFailure: true,
      },
      {
        type: "execution.recheck",
        issueId: "unknown",
        note: "test",
        simulateFailure: true,
      },
    ];
    for (const command of commands)
      await expect(service.execute(c, command)).rejects.toThrow(
        "未启用演示工具",
      );
    expect(await service.getProject(c.projectId)).toEqual(before);
  });

  it("generates a plan through the normal command even when demo tools are disabled", async () => {
    const c = await createProject();
    await service.execute(c, { type: "stage.confirm", target: "planning" });
    const inherited = await service.getProject(c.projectId);
    const planning = inherited.conversations.find(
      (chat) => chat.stageId === "planning",
    )!;
    const p = {
      ...c,
      conversationId: planning.id,
      stageId: "planning" as const,
    };
    const generation = service.execute(p, { type: "planning.generate" });
    await vi.runAllTimersAsync();
    await generation;
    const generated = await service.getProject(c.projectId);
    const ids = generated.planning!.batches.flatMap((batch) => batch.assetIds);
    expect(generated.planningStatus).toBe("completed");
    expect(generated.planning!.batches).toHaveLength(8);
    expect(ids).toHaveLength(186);
    expect(new Set(ids).size).toBe(ids.length);
    const catalog = await service.catalog();
    const sampleRequest = service
      .sendMessage(p, {
        text: "使用样例数据调整规划",
        requestId: "sample-disabled",
        agentId: catalog.defaultAgent,
        modelId: catalog.defaultModel,
      })
      .catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await sampleRequest).toMatchObject({ code: "PRECONDITION" });
    expect(
      (await service.getProject(c.projectId)).planning?.preview,
    ).toBeUndefined();
  });
});
