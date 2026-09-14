import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { BusinessResults } from "../BusinessResults";
import { MockMigrationService } from "@/services/mock";
const actions = {
  onPanel: () => {},
  onDownload: () => {},
  onCommand: () => {},
  onStage: () => {},
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
