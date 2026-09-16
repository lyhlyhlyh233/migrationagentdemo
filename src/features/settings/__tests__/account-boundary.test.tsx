import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AccountState } from "@/domain/models";
import { NexentSettings } from "../NexentSettings";

function render(account: AccountState, demoTools = false) {
  return renderToStaticMarkup(
    <NexentSettings
      account={account}
      demoTools={demoTools}
      onChange={async () => account}
    />,
  );
}

describe("account presentation boundary", () => {
  it.each([
    [{ configured: false, verified: false }, "未配置"],
    [
      { configured: true, verified: false, method: "api-key" },
      "已配置 · 未验证",
    ],
    [
      { configured: true, verified: true, method: "account" },
      "已配置 · 已验证",
    ],
  ] satisfies [AccountState, string][])(
    "shows the service account status without inferring verification",
    (account, expected) => {
      const html = render(account);
      expect(html).toContain(expected);
      expect(html).toMatch(/id="nexent-secret"[^>]*value=""/);
      expect(html).not.toContain("尚未连接 Nexent 服务");
    },
  );

  it("only shows the local Mock configuration explanation when demo tools are available", () => {
    const account = { configured: false, verified: false };
    expect(render(account, true)).toContain("尚未连接 Nexent 服务");
    expect(render(account, false)).toContain("认证状态由服务返回");
  });
});
