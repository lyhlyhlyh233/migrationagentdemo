import { Fragment } from "react";
import type { RiskItem } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { riskImpactLabels, riskStrategyLabels } from "@/shared/i18n/risks";
import { Icon } from "@/shared/ui/icons";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow, type PageState } from "@/shared/ui/pagination-state";
import { SelectionCheckbox } from "@/shared/ui/SelectionCheckbox";
import {
  ruleGroups,
  selectionState,
  strategyLabel,
  vmCount,
} from "./presentation";
import type { RiskInteractions } from "./RiskVmDetails";
import { RiskVmTable } from "./RiskVmTable";
import styles from "./RiskPanel.module.css";

export interface CategoryTableView {
  pagination: PageState;
  expanded: string[];
  vmPages: Record<string, PageState>;
}
export const initialCategoryView = (): CategoryTableView => ({
  pagination: { page: 1, size: 20 },
  expanded: [],
  vmPages: {},
});

export function CategoryRiskTable({
  risks,
  allRisks,
  drawer,
  selected,
  onSelect,
  view,
  onView,
  ...actions
}: {
  risks: RiskItem[];
  allRisks: RiskItem[];
  drawer: boolean;
  selected: ReadonlySet<number>;
  onSelect: (risks: RiskItem[], checked: boolean) => void;
  view: CategoryTableView;
  onView: (view: CategoryTableView) => void;
} & RiskInteractions) {
  const t = useTranslation();
  const groups = ruleGroups(risks);
  const range = pageWindow(groups.length, view.pagination);
  const rows = groups.slice(range.start, range.end);
  const pageRisks = rows.flatMap((group) => group.risks);
  return (
    <div>
      <div className={styles.tableSelection}>
        <span>{t("本页 {0} 个小类", rows.length)}</span>
        <button
          className={styles.textAction}
          disabled={
            !actions.editable ||
            actions.saving ||
            !risks.some((r) => r.stage === "research")
          }
          onClick={() => onSelect(risks, true)}
        >
          {t(
            "选择本类全部 {0} 项",
            groups.filter((g) => g.risks.some((r) => r.stage === "research"))
              .length,
          )}
        </button>
      </div>
      <div
        className={styles.tableScroll}
        role="region"
        aria-label={t("分类风险列表")}
        tabIndex={0}
      >
        <table className={`${styles.table} ${styles.riskTable}`}>
          <colgroup>
            <col className={styles.checkboxColumn} />
            <col style={{ width: "32%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "18%" }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>
                <SelectionCheckbox
                  label={t("选择本页小类")}
                  {...selectionState(pageRisks, selected)}
                  disabled={
                    !actions.editable ||
                    actions.saving ||
                    !pageRisks.some((r) => r.stage === "research")
                  }
                  onChange={(checked) => onSelect(pageRisks, checked)}
                />
              </th>
              <th>{t("风险事项")}</th>
              <th>{t("迁移影响")}</th>
              <th>{t("受影响虚拟机")}</th>
              <th>{t("当前策略")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, risks: items }) => {
              const risk = items[0];
              const labels = [...new Set(items.map(strategyLabel))];
              const open = view.expanded.includes(key);
              const editor = actions.editorFor(`rule:${key}`);
              const recommendations = new Set(
                items.map((r) => r.recommendedStrategy),
              );
              const rowSelected = items.some((r) => selected.has(r.id));
              return (
                <Fragment key={key}>
                  <tr data-selected={rowSelected}>
                    <td>
                      <SelectionCheckbox
                        label={t("选择小类 {0}", t(risk.description))}
                        {...selectionState(items, selected)}
                        disabled={
                          !actions.editable ||
                          actions.saving ||
                          !items.some((r) => r.stage === "research")
                        }
                        onChange={(checked) => onSelect(items, checked)}
                      />
                    </td>
                    <th scope="row">
                      <strong>{t(risk.description)}</strong>
                      <small>{t(risk.rule ?? "规划风险")}</small>
                    </th>
                    <td>
                      <span className={styles.impact} data-impact={risk.impact}>
                        {t(
                          risk.impact
                            ? riskImpactLabels[risk.impact]
                            : "规划风险",
                        )}
                      </span>
                      <small>
                        {t(
                          items.some((r) => r.level === "high")
                            ? "高风险"
                            : risk.level,
                        )}
                      </small>
                    </td>
                    <td>
                      <button
                        className={styles.textAction}
                        aria-expanded={open}
                        disabled={actions.saving}
                        onClick={() =>
                          onView({
                            ...view,
                            expanded: open
                              ? view.expanded.filter((k) => k !== key)
                              : [...view.expanded, key],
                          })
                        }
                      >
                        <Icon name={open ? "chevron" : "right"} size={12} />
                        {t("{0} 台", vmCount(items))}
                      </button>
                    </td>
                    <td>
                      <span>
                        {t(labels.length === 1 ? labels[0] : "含单台例外")}
                      </span>
                      {recommendations.size > 1 ? (
                        <small>{t("按各项建议分别处理")}</small>
                      ) : (
                        risk.recommendedStrategy && (
                          <small>
                            {t(
                              "建议：{0}",
                              t(riskStrategyLabels[risk.recommendedStrategy]),
                            )}
                          </small>
                        )
                      )}
                      {items.some((r) => r.stage === "research") && (
                        <button
                          className={styles.textAction}
                          disabled={!actions.editable || actions.saving}
                          onClick={() =>
                            actions.onEdit(`rule:${key}`, items, true)
                          }
                        >
                          {t("设置策略")}
                        </button>
                      )}
                    </td>
                  </tr>
                  {editor && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={5}>{editor}</td>
                    </tr>
                  )}
                  {open && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={5}>
                        <RiskVmTable
                          risks={items}
                          allRisks={allRisks}
                          readOnly={drawer}
                          subtable
                          label={t("{0}的虚拟机", t(risk.description))}
                          selected={selected}
                          onSelect={onSelect}
                          pagination={
                            view.vmPages[key] ?? { page: 1, size: 10 }
                          }
                          onPage={(page) =>
                            onView({
                              ...view,
                              vmPages: { ...view.vmPages, [key]: page },
                            })
                          }
                          {...actions}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        label={t("小类分页")}
        total={groups.length}
        value={view.pagination}
        onChange={(pagination) => onView({ ...view, pagination })}
        disabled={actions.saving}
      />
    </div>
  );
}
