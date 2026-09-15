import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanningAssets } from "./PlanningAssets";
import { initialPlanningView } from "./state";
import type { PlanningAsset } from "@/domain/planning";

const assets: PlanningAsset[] = Array.from({ length: 10000 }, (_, i) => ({
  id: `vm-${i + 1}`,
  name: `ASSET-${String(i + 1).padStart(5, "0")}`,
  system: i < 5000 ? "服务甲" : "服务乙",
  grade: "general",
  clusterType: "",
  clusterRole: "",
  cpu: 4,
  memory: 16,
  disks: 1,
  storage: 80,
  os: "Linux",
  method: "agentless",
  strategy: "",
  riskScore: 0,
  riskLevel: "none",
}));
describe("planning VM pagination", () => {
  it("renders one page from 10,000 assets and keeps off-page selections", () => {
    const view = {
      ...initialPlanningView(),
      selected: ["vm-1", "vm-10000"],
      assetPage: { page: 500, size: 20 },
    };
    const markup = renderToStaticMarkup(
      <PlanningAssets
        assets={assets}
        view={view}
        onView={() => {}}
        locked={false}
      />,
    );
    expect(
      markup.match(/<tbody>[\s\S]*?<\/tbody>/)![0].match(/<tr /g),
    ).toHaveLength(20);
    expect(markup).toContain("ASSET-10000");
    expect(markup).not.toContain("ASSET-00001");
    expect(markup).toContain("已选 2 台");
    expect(markup).toContain("选择全部筛选结果 10000 台");
  });
  it("limits business-system drill-in without dropping stable VM identifiers", () => {
    const view = {
      ...initialPlanningView(),
      systemFocus: "服务乙",
      assetPage: { page: 1, size: 20 },
    };
    const markup = renderToStaticMarkup(
      <PlanningAssets
        assets={assets}
        view={view}
        onView={() => {}}
        locked={false}
        attributes
      />,
    );
    expect(markup).toContain("ASSET-05001");
    expect(markup).not.toContain("ASSET-00001");
    expect(markup).toContain("5000 台");
  });
});
