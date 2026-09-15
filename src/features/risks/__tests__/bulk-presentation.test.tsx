import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { pageWindow } from "@/shared/ui/pagination-state";
import {
  categoryGroups,
  ruleGroups,
  selectionState,
  toggleRiskSelection,
  vmGroups,
} from "../presentation";
import { CategoryRiskTable, initialCategoryView } from "../CategoryRiskTable";
import { RiskVmTable } from "../RiskVmTable";
import { RiskWorkspace } from "../RiskWorkspace";
import { MockMigrationService } from "@/services/mock";
import { largeRiskFixture } from "./risk-fixtures";

const actions = {
  editable: true,
  saving: false,
  onEdit: () => {},
  editing: false,
  onCommand: async () => true,
};
describe("risk table selection and pagination", () => {
  it("unifies category, rule and VM selections by finding ID across pages", () => {
    const risks = largeRiskFixture();
    const firstRule = ruleGroups(risks)[0].risks;
    let selected = toggleRiskSelection(new Set(), firstRule, true);
    expect(selected.size).toBe(60);
    expect(selectionState(risks, selected).mixed).toBe(true);
    selected = toggleRiskSelection(selected, risks, true);
    expect(selected.size).toBe(105);
    selected = toggleRiskSelection(selected, [risks[15]], false);
    expect(selectionState(firstRule, selected)).toMatchObject({
      checked: false,
      mixed: true,
    });
    selected = toggleRiskSelection(
      selected,
      categoryGroups(risks)[0].risks,
      true,
    );
    expect(selectionState(risks, selected).checked).toBe(true);
    expect(
      toggleRiskSelection(
        selected,
        [{ ...risks[0], id: 1000, stage: "planning" }],
        true,
      ).has(1000),
    ).toBe(false);
    expect(toggleRiskSelection(new Set(), risks.slice(0, 20), true).size).toBe(
      20,
    );
  });

  it("renders real VM subtables with 10 rows and preserves controlled pages after reopening", () => {
    const risks = largeRiskFixture();
    const groups = ruleGroups(risks);
    const key = groups[0].key;
    const view = {
      ...initialCategoryView(),
      expanded: [key],
      vmPages: { [key]: { page: 3, size: 10 } },
    };
    const render = (expanded: string[], readOnlyVms = false) =>
      renderToStaticMarkup(
        <CategoryRiskTable
          risks={risks}
          allRisks={risks}
          readOnlyVms={readOnlyVms}
          selected={new Set()}
          onSelect={() => {}}
          view={{ ...view, expanded }}
          onView={() => {}}
          {...actions}
        />,
      );
    const open = render([key]);
    expect(open.match(/<table/g)).toHaveLength(2);
    const panel = render([key], true);
    expect(panel.match(/<table/g)).toHaveLength(1);
    expect(panel).not.toContain("TEST-VM-021");
    expect(open).toContain("TEST-VM-021");
    expect(open).toContain("TEST-VM-030");
    expect(open).not.toContain("TEST-VM-020");
    expect(open).not.toContain("TEST-VM-031");
    expect(open).toContain("本项策略");
    expect(open).toContain("标识");
    expect(render([])).not.toContain("TEST-VM-021");
    expect(render([key])).toContain("TEST-VM-021");
    const thirdPage = renderToStaticMarkup(
      <CategoryRiskTable
        risks={risks}
        allRisks={risks}
        readOnlyVms
        selected={new Set(risks.map((r) => r.id))}
        onSelect={() => {}}
        view={{ ...view, expanded: [], pagination: { page: 3, size: 20 } }}
        onView={() => {}}
        {...actions}
      />,
    );
    expect(thirdPage).toContain("Risk 105");
    expect(thirdPage).not.toContain("Shared disk constraint");
    expect(thirdPage).toContain('checked=""');
  });

  it("computes VM eligibility using all risks and hides pagination arrows on one page", () => {
    const risks = largeRiskFixture().slice(0, 1);
    const html = renderToStaticMarkup(
      <RiskVmTable
        risks={risks}
        allRisks={[...risks, { ...risks[0], id: 999, impact: "blocked" }]}
        pagination={{ page: 1, size: 10 }}
        onPage={() => {}}
        label="VM list"
        readOnly
        selected={new Set()}
        onSelect={() => {}}
        {...actions}
      />,
    );
    expect(html).toContain("暂时排除");
    expect(html).not.toContain("上一页");
    expect(html).not.toContain("下一页");
    expect(html).not.toContain("每页条数");
    expect(html).toContain("共 1 项");
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("单独处理");
    expect(vmGroups([...risks, { ...risks[0], id: 2 }])).toHaveLength(1);
    expect(pageWindow(5, { page: 8, size: 20 })).toEqual({
      page: 1,
      pages: 1,
      start: 0,
      end: 5,
    });
  });

  it("opens a deep-linked VM on its actual page with risks expanded", async () => {
    const service = new MockMigrationService();
    const snapshot = await service.getProject("lobby");
    snapshot.risks = largeRiskFixture();
    const html = renderToStaticMarkup(
      <RiskWorkspace
        snapshot={snapshot}
        location={{
          mode: "vm",
          vmKey: "id:fixture-vm-53",
          sourceRiskIds: snapshot.risks.slice(10).map((r) => r.id),
        }}
        onLocationChange={() => {}}
        onCommand={async () => true}
      />,
    );
    expect(html).toContain("TEST-VM-053");
    expect(html).toContain("清除范围，查看全部");
    expect(html).toContain("Shared disk constraint");
    expect(html).not.toContain("TEST-VM-021");
    service.dispose();
  });
});
