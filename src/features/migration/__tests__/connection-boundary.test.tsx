import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { MockMigrationService } from "@/services/mock";
import { ConnectionForm } from "../ConnectionForm";
import { initialExecutionView } from "@/stores/executionState";

let service: MockMigrationService | undefined;
afterEach(() => service?.dispose());

async function render(demoTools: boolean) {
  service = new MockMigrationService();
  const snapshot = await service.getProject("lobby");
  snapshot.execution = {
    revision: 0,
    connectionStatus: "unconfigured",
    tasks: [],
    issues: [],
    validations: [],
    feedback: [],
    trend: [],
    finalized: false,
  };
  return renderToStaticMarkup(
    <ConnectionForm
      snapshot={snapshot}
      view={initialExecutionView()}
      onView={() => {}}
      onCommand={async () => true}
      sampleConnection={{
        ip: "192.0.2.77",
        port: 8443,
        username: "sample-operator",
        password: "sample-credential",
      }}
      demoTools={demoTools}
    />,
  );
}

describe("connection demonstration boundary", () => {
  it("does not prefill sample credentials or offer failure injection without the capability", async () => {
    const html = await render(false);
    expect(html).not.toContain("192.0.2.77");
    expect(html).not.toContain("sample-operator");
    expect(html).not.toContain("sample-credential");
    expect(html).not.toContain("使用样例配置");
    expect(html).not.toContain("模拟检测选项");
    expect(html).not.toContain("模拟连接，不访问真实服务");
    expect(html).toContain("尚未检测连接");
  });

  it("preserves sample setup and failure options for the Mock walkthrough", async () => {
    const html = await render(true);
    expect(html).toContain("192.0.2.77");
    expect(html).toContain("sample-operator");
    expect(html).toContain("sample-credential");
    expect(html).toContain("使用样例配置");
    expect(html).toContain("模拟检测选项");
  });
});
