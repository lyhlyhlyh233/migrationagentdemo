import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { pageWindow } from "@/shared/ui/pagination-state";
import {
  categoryGroups,
  vmCount,
  ruleGroups,
  selectionState,
  toggleRiskSelection,
} from "../presentation";
import { CategoryRiskTable, initialCategoryView } from "../CategoryRiskTable";
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

  it("keeps category pagination and static VM counts without removed detail links", () => {
    const risks = largeRiskFixture();
    const render = (page: number) =>
      renderToStaticMarkup(
        <CategoryRiskTable
          risks={risks}
          selected={new Set(risks.map((r) => r.id))}
          onSelect={() => {}}
          view={{ ...initialCategoryView(), pagination: { page, size: 20 } }}
          onView={() => {}}
          {...actions}
        />,
      );
    const first = render(1);
    expect(first.match(/<table/g)).toHaveLength(1);
    expect(first).toContain("Shared disk constraint");
    expect(first).not.toContain("单独处理");
    expect(first).not.toContain("TEST-VM-021");
    const third = render(3);
    expect(third).toContain("Risk 105");
    expect(third).not.toContain("Shared disk constraint");
    expect(third).toContain('checked=""');
    expect(render(1)).toContain("Shared disk constraint");
  });
  it("deduplicates VM totals and clamps pagination after filters", () => {
    const risks = largeRiskFixture().slice(0, 1);
    expect(vmCount([...risks, { ...risks[0], id: 2 }])).toBe(1);
    expect(pageWindow(5, { page: 8, size: 20 })).toEqual({
      page: 1,
      pages: 1,
      start: 0,
      end: 5,
    });
  });
});
