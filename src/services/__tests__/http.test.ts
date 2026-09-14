import { describe, expect, it, vi } from "vitest";
import { createHttpService } from "../http";
import { createHttpClient } from "../http/client";
describe("HTTP adapter preparation", () => {
  it("unconfigured mode explicitly rejects rather than returning mock data", async () => {
    await expect(
      createHttpService({ baseUrl: "" }).catalog(),
    ).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
  });
  it("passes cancellation through and maps failures", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi
      .fn()
      .mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const request = createHttpClient("/internal", fetcher);
    await expect(
      request("capability", { signal: controller.signal }, (v) => v),
    ).rejects.toMatchObject({ code: "ABORTED" });
    expect(fetcher).toHaveBeenCalledWith(
      "/internal/capability",
      expect.objectContaining({ signal: controller.signal }),
    );
    const unavailable = createHttpClient(
      "",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    await expect(unavailable("capability", {}, (v) => v)).rejects.toMatchObject(
      { code: "HTTP", status: 503 },
    );
  });
  it("keeps body-read cancellation distinct from malformed JSON", async () => {
    const controller = new AbortController();
    const request = createHttpClient(
      "/internal",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          controller.abort();
          throw new DOMException("Aborted", "AbortError");
        },
      }),
    );
    await expect(
      request("capability", { signal: controller.signal }, (v) => v),
    ).rejects.toMatchObject({ code: "ABORTED" });
    const invalidJson = createHttpClient(
      "/internal",
      vi.fn().mockResolvedValue(new Response("invalid JSON")),
    );
    await expect(invalidJson("capability", {}, (v) => v)).rejects.toMatchObject(
      { code: "HTTP" },
    );
  });
});
