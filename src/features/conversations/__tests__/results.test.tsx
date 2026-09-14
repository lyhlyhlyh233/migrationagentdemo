import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { Conversation } from "../Conversation";
import { BusinessResults } from "../BusinessResults";
import { MockMigrationService } from "@/services/mock";
const actions = {
  onPanel: () => {},
  onDownload: () => {},
  onCommand: async () => true,
  onStage: () => {},
  onNavigateStage: () => {},
};
describe("business result rendering", () => {
  it("limits a file list to three rows with expansion and real download controls", async () => {
    const service = new MockMigrationService();
    const snapshot = await service.getProject("lobby");
    snapshot.artifacts = Array.from({ length: 5 }, (_, i) => ({
      id: `file-${i}`,
      label: `File ${i}`,
      filename: `report-${i}.txt`,
      mediaType: "text/plain",
      stageId: "research",
      kind: "report",
    }));
    const html = renderToStaticMarkup(
      <BusinessResults
        snapshot={snapshot}
        results={[
          {
            kind: "artifacts",
            artifactIds: snapshot.artifacts.map((a) => a.id),
          },
        ]}
        {...actions}
      />,
    );
    expect(html).toContain("report-2.txt");
    expect(html).not.toContain("report-3.txt");
    expect(html).toContain("展开其余 2 项");
    expect(html).toContain("下载 report-0.txt");
    service.dispose();
  });
  it("keeps completed preparation collapsed and provides one copy action after the final result", async () => {
    const service = new MockMigrationService();
    const snapshot = await service.getProject("lobby");
    snapshot.assessmentStatus = "completed";
    const base = {
      conversationId: "c",
      time: "10:00",
      stageId: "research" as const,
    };
    snapshot.messages = [
      { ...base, id: 1, role: "user", text: "开始调研评估" },
      {
        ...base,
        id: 2,
        role: "agent",
        text: "请提供资料",
        activity: "assessment-preparation",
        results: [
          { kind: "assessment-input", files: { rvtools: "", presales: "" } },
        ],
      },
      {
        ...base,
        id: 3,
        role: "user",
        text: "使用示例",
        activity: "assessment-preparation",
      },
      {
        ...base,
        id: 4,
        role: "agent",
        text: "最终评估结论",
        reply: { summary: "核对完成", durationMs: 1600 },
        results: [
          {
            kind: "summary",
            title: "评估统计",
            stageId: "research",
            metrics: [{ label: "按现状可迁", value: 119 }],
          },
        ],
      },
    ];
    const html = renderToStaticMarkup(
      <Conversation
        snapshot={snapshot}
        chat={{ id: "c", title: "评估", kind: "main", stageId: "research" }}
        view={{ draft: "" }}
        onUpload={() => {}}
        onCloseWork={() => {}}
        {...actions}
      />,
    );
    expect(html.match(/aria-label="复制回答正文"/g)).toHaveLength(1);
    expect(html).toContain("资料准备记录");
    expect(html).not.toContain('type="file"');
    expect(html.indexOf('aria-label="评估统计"')).toBeLessThan(
      html.indexOf('aria-label="复制回答正文"'),
    );
    service.dispose();
  });
  it("renders confirmed approvals without another execution button", async () => {
    const service = new MockMigrationService();
    const snapshot = await service.getProject("lobby");
    snapshot.approvals = [
      {
        id: "a",
        title: "执行确认",
        description: "已确认",
        checks: [],
        status: "confirmed",
        action: { kind: "execution", target: "creation" },
      },
    ];
    const html = renderToStaticMarkup(
      <BusinessResults
        snapshot={snapshot}
        results={[{ kind: "approval", approvalId: "a" }]}
        {...actions}
      />,
    );
    expect(html).toContain("已确认");
    expect(html).not.toContain("<button");
    service.dispose();
  });
});
