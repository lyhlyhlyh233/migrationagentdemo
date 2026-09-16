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
  it("keeps planning intake visible after a risk summary reply", async () => {
    const service = new MockMigrationService();
    const snapshot = await service.getProject("lobby");
    const base = {
      conversationId: "planning-chat",
      stageId: "planning" as const,
      time: "10:00",
      role: "agent" as const,
    };
    snapshot.messages = [
      {
        ...base,
        id: 1,
        text: "补充规划资料",
        results: [{ kind: "planning-input" }],
      },
      {
        ...base,
        id: 2,
        text: "当前风险概况",
        results: [
          {
            kind: "summary",
            stageId: "planning",
            title: "风险概况",
            metrics: [],
          },
        ],
      },
    ];
    const html = renderToStaticMarkup(
      <Conversation
        snapshot={snapshot}
        chat={{
          id: "planning-chat",
          title: "规划",
          kind: "main",
          stageId: "planning",
        }}
        view={{ draft: "" }}
        planningInput={
          <section aria-label="规划资料补充">导入与基础约束</section>
        }
        onUpload={() => {}}
        onCloseWork={() => {}}
        {...actions}
      />,
    );
    expect(html).toContain('aria-label="规划资料补充"');
    expect(html).toContain("导入与基础约束");
    expect(html).toContain("当前风险概况");
    service.dispose();
  });
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
  it("waits for the originating reply before opening a connection editor", async () => {
    const service = new MockMigrationService();
    const snapshot = await service.getProject("lobby");
    snapshot.pending = { migration: { startedAt: 0, runId: "pending-reply" } };
    const render = (conversationId: string) =>
      renderToStaticMarkup(
        <BusinessResults
          snapshot={snapshot}
          conversationId={conversationId}
          results={[{ kind: "execution-work", view: "connection" }]}
          {...actions}
        />,
      );
    expect(render("migration")).toMatch(/<button[^>]*disabled/);
    expect(render("other")).not.toMatch(/<button[^>]*disabled/);
    delete snapshot.pending.migration;
    expect(render("migration")).not.toMatch(/<button[^>]*disabled/);
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
