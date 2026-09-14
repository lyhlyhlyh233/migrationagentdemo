import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_WORKSPACE_ID } from "@/domain/models";
import { createServices } from "../index";
import type { MigrationService } from "../contracts";

let service: MigrationService | undefined;
afterEach(() => {
  service?.dispose();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("service composition and lifecycle", () => {
  it("uses injected configuration instead of reading build environment inside services", async () => {
    vi.stubEnv("VITE_SERVICE_MODE", "http");
    service = createServices({ mode: "mock", apiBaseUrl: "" });
    expect(await service.listProjects()).toEqual([]);
    expect((await service.getProject(EMPTY_WORKSPACE_ID)).info).toBeNull();
    const catalog = await service.catalog();
    expect(
      Object.values(catalog.stageAgents ?? {}).every((id) =>
        catalog.agents.some((agent) => agent.id === id),
      ),
    ).toBe(true);
  });
  it.each(["", "/internal"])(
    "never contacts a backend or returns mock success in unimplemented HTTP mode (%s)",
    async (apiBaseUrl) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      service = createServices({ mode: "http", apiBaseUrl });
      await expect(service.catalog()).rejects.toMatchObject({
        code: "NOT_CONFIGURED",
      });
      await expect(service.listProjects()).rejects.toMatchObject({
        code: "NOT_CONFIGURED",
      });
      await expect(service.configureAccount(null)).rejects.toMatchObject({
        code: "NOT_CONFIGURED",
      });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("rejects unknown service modes", () => {
    expect(() => createServices({ mode: "typo", apiBaseUrl: "" })).toThrow(
      "未知服务模式",
    );
  });
  it("honors cancellation before snapshot, conversation, upload, account and logout operations", async () => {
    vi.useFakeTimers();
    service = createServices({ mode: "mock", apiBaseUrl: "" });
    const project = await service.createProject(
      {
        siteName: "接口边界检查",
        office: "上海",
        industry: "金融",
        region: "中国",
        migrationType: "虚拟化",
      },
      "zh-CN",
    );
    await vi.runAllTimersAsync();
    const before = await service.getProject(project.id);
    const events = vi.fn();
    service.subscribe(events);
    const controller = new AbortController();
    controller.abort();
    const options = { signal: controller.signal };
    const context = {
      projectId: project.id,
      conversationId: project.conversations[0].id,
      stageId: "research" as const,
      language: "zh-CN" as const,
    };
    const operations = [
      () => service!.getProject(project.id, options),
      () =>
        service!.createConversation(project.id, "research", "zh-CN", options),
      () =>
        service!.renameConversation(
          project.id,
          context.conversationId,
          "不能保存",
          options,
        ),
      () =>
        service!.upload(
          context,
          "rvtools",
          new File(["data"], "assets.xlsx"),
          options,
        ),
      () =>
        service!.configureAccount(
          { method: "api-key", apiKey: "test-placeholder" },
          options,
        ),
      () => service!.logout(options),
    ];
    for (const operation of operations)
      await expect(operation()).rejects.toMatchObject({ code: "ABORTED" });
    expect(events).not.toHaveBeenCalled();
    expect(await service.getProject(project.id)).toEqual(before);
    expect((await service.getAccount()).configured).toBe(false);
  });
});
