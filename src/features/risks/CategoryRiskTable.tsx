import { Fragment, useState } from "react";
import type { RiskItem } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { riskImpactLabels } from "@/shared/i18n/risks";
import { Status } from "@/shared/ui/Status";
import { Icon } from "@/shared/ui/icons";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow, type PageState } from "@/shared/ui/pagination-state";
import { SelectionCheckbox } from "@/shared/ui/SelectionCheckbox";
import {
  highestRiskLevel,
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
  readOnlyVms,
  selected,
  onSelect,
  view,
  onView,
  ...actions
}: {
  risks: RiskItem[];
  allRisks: RiskItem[];
  readOnlyVms: boolean;
  selected: ReadonlySet<number>;
  onSelect: (risks: RiskItem[], checked: boolean) => void;
  view: CategoryTableView;
  onView: (view: CategoryTableView) => void;
} & RiskInteractions) {
  const t = useTranslation();
  const [details, setDetails] = useState<string[]>([]);
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
            actions.editing ||
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
            <col />
            <col className={styles.levelColumn} />
            <col className={styles.impactColumn} />
            <col className={styles.vmCountColumn} />
            <col className={styles.strategyColumn} />
            <col className={styles.actionsColumn} />
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
                    actions.editing ||
                    !pageRisks.some((r) => r.stage === "research")
                  }
                  onChange={(checked) => onSelect(pageRisks, checked)}
                />
              </th>
              <th>{t("风险事项")}</th>
              <th>{t("级别")}</th>
              <th>{t("迁移影响")}</th>
              <th>{t("虚拟机数")}</th>
              <th>{t("当前策略")}</th>
              <th>{t("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, risks: items }) => {
              const risk = items[0];
              const labels = [...new Set(items.map(strategyLabel))];
              const open = view.expanded.includes(key);
              const detailsOpen = details.includes(key);
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
                          actions.editing ||
                          !items.some((r) => r.stage === "research")
                        }
                        onChange={(checked) => onSelect(items, checked)}
                      />
                    </td>
                    <th scope="row">
                      <strong>{t(risk.description)}</strong>
                    </th>
                    <td data-label={t("级别")}>
                      <Status value={highestRiskLevel(items)} />
                    </td>
                    <td data-label={t("迁移影响")}>
                      <span className={styles.impact} data-impact={risk.impact}>
                        {t(
                          risk.impact
                            ? riskImpactLabels[risk.impact]
                            : "规划风险",
                        )}
                      </span>
                    </td>
                    <td data-label={t("虚拟机数")}>
                      <button
                        className={styles.textAction}
                        aria-expanded={open}
                        aria-label={t("{0} 台", vmCount(items))}
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
                        {vmCount(items)}
                      </button>
                    </td>
                    <td data-label={t("当前策略")}>
                      <span>
                        {t(labels.length === 1 ? labels[0] : "含单台例外")}
                      </span>
                    </td>
                    <td data-actions>
                      <div className={styles.rowActions}>
                        <button
                          className={styles.textAction}
                          aria-expanded={detailsOpen}
                          onClick={() =>
                            setDetails(
                              detailsOpen
                                ? details.filter((k) => k !== key)
                                : [...details, key],
                            )
                          }
                        >
                          {t("查看详情")}
                        </button>
                        {items.some((r) => r.stage === "research") && (
                          <button
                            className={styles.textAction}
                            disabled={
                              !actions.editable ||
                              actions.saving ||
                              actions.editing
                            }
                            onClick={() =>
                              actions.onEdit(`rule:${key}`, items, true)
                            }
                          >
                            {t("设置策略")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {detailsOpen && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={7}>
                        <dl className={styles.ruleDetails}>
                          <div>
                            <dt>{t("规则依据")}</dt>
                            <dd>{t(risk.rule ?? "规划风险")}</dd>
                          </div>
                          <div>
                            <dt>{t("评估建议")}</dt>
                            <dd>
                              {[
                                ...new Set(
                                  items.map(
                                    (r) => r.recommendation ?? r.description,
                                  ),
                                ),
                              ].map((note) => (
                                <p key={note}>{t(note)}</p>
                              ))}
                            </dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  )}
                  {open && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={7}>
                        <RiskVmTable
                          risks={items}
                          allRisks={allRisks}
                          readOnly={readOnlyVms}
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
        compact
        label={t("小类分页")}
        total={groups.length}
        value={view.pagination}
        onChange={(pagination) => onView({ ...view, pagination })}
        disabled={actions.saving}
      />
    </div>
  );
}
