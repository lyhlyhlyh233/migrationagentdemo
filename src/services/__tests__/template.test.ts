import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockMigrationService } from "../mock";

const template = readFileSync(
  new URL("../mock/templates/migration-survey-template.xlsx", import.meta.url),
);
let service: MockMigrationService;
let projectId: string;
beforeEach(async () => {
  vi.useFakeTimers();
  service = new MockMigrationService();
  const project = await service.createProject(
    {
      industry: "金融",
      region: "中国地区部",
      office: "上海",
      siteName: "模板下载",
      migrationType: "虚拟化",
    },
    "zh-CN",
  );
  projectId = project.id;
  await vi.runAllTimersAsync();
});
afterEach(() => {
  service.dispose();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("migration survey template", () => {
  it("downloads the original workbook before upload without changing project state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(template)));
    const before = await service.getProject(projectId);
    const file = await service.download(projectId, "research-template");
    expect(file.filename).toBe("迁移调研表模板.xlsx");
    expect(file.mediaType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(file.blob.type).toBe(file.mediaType);
    expect(Buffer.from(await file.blob.arrayBuffer())).toEqual(template);
    expect(await service.getProject(projectId)).toEqual(before);
    await expect(
      service.download("unknown", "research-template"),
    ).rejects.toThrow();
  });

  it("rejects missing files and HTML fallbacks, then allows retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("missing", { status: 404 }))
        .mockResolvedValueOnce(new Response("<!doctype html>"))
        .mockRejectedValueOnce(new TypeError("network failure"))
        .mockResolvedValueOnce(new Response(template)),
    );
    await expect(
      service.download(projectId, "research-template"),
    ).rejects.toMatchObject({ code: "HTTP" });
    await expect(
      service.download(projectId, "research-template"),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      service.download(projectId, "research-template"),
    ).rejects.toMatchObject({ code: "NETWORK" });
    expect(
      (await service.download(projectId, "research-template")).blob.size,
    ).toBe(template.length);
  });

  it("cancels an in-flight download on request cancellation and logout", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, { signal }: RequestInit) =>
          new Promise((_resolve, reject) => {
            signals.push(signal!);
            signal!.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      ),
    );
    const controller = new AbortController();
    const cancelled = expect(
      service.download(projectId, "research-template", {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "ABORTED" });
    controller.abort();
    await cancelled;
    const ended = expect(
      service.download(projectId, "research-template"),
    ).rejects.toMatchObject({ code: "ABORTED" });
    await service.logout();
    await ended;
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
