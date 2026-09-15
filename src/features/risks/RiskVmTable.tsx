import { Fragment, useEffect, useRef, useState } from "react";
import type { RiskItem } from "@/domain/models";
import { hasRiskDecision, riskReadyForExecution } from "@/domain/assessment";
import { useTranslation } from "@/shared/i18n";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow, type PageState } from "@/shared/ui/pagination-state";
import { SelectionCheckbox } from "@/shared/ui/SelectionCheckbox";
import { Button } from "@/shared/ui/primitives";
import { RiskVmDetails, type RiskInteractions } from "./RiskVmDetails";
import { selectionState, strategyLabel, vmGroups, vmKey } from "./presentation";
import styles from "./RiskPanel.module.css";

export function RiskVmTable({
  risks,
  allRisks,
  pagination,
  onPage,
  label,
  readOnly = false,
  subtable = false,
  selected,
  onSelect,
  expandedVm,
  onExpandVm,
  ...actions
}: {
  risks: RiskItem[];
  allRisks: RiskItem[];
  pagination: PageState;
  onPage: (page: PageState) => void;
  label: string;
  readOnly?: boolean;
  subtable?: boolean;
  selected: ReadonlySet<number>;
  onSelect: (risks: RiskItem[], checked: boolean) => void;
  expandedVm?: string;
  onExpandVm?: (key?: string) => void;
} & RiskInteractions) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState<string[]>([]);
  const selectedRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    selectedRow.current?.scrollIntoView({
      block: "nearest",
      behavior: "instant",
    });
  }, [expandedVm]);
  const groups = vmGroups(risks);
  const range = pageWindow(groups.length, pagination);
  const rows = groups.slice(range.start, range.end);
  const pageRisks = rows.flatMap((row) => row.risks);
  const selectable = !readOnly;
  const columns = (subtable ? 5 : 7) + (selectable ? 1 : 0);
  function toggle(key: string, open: boolean) {
    if (onExpandVm) onExpandVm(open ? undefined : key);
    else
      setExpanded(
        open ? expanded.filter((value) => value !== key) : [...expanded, key],
      );
  }
  return (
    <div className={subtable ? styles.subtable : undefined}>
      <div
        className={styles.tableScroll}
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <table
          className={`${styles.table} ${styles.vmTable}`}
          data-subtable={subtable}
          data-selectable={selectable}
        >
          <colgroup>
            {selectable && <col className={styles.checkboxColumn} />}
            <col />
            <col className={styles.identifierColumn} />
            {!subtable && <col className={styles.vmCountColumn} />}
            <col className={styles.strategyColumn} />
            <col className={styles.strategyColumn} />
            {!subtable && <col className={styles.progressColumn} />}
            <col className={styles.actionsColumn} />
          </colgroup>
          <thead>
            <tr>
              {selectable && (
                <th>
                  <SelectionCheckbox
                    label={t("选择本页虚拟机")}
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
              )}
              <th>{t("名称")}</th>
              <th>{t("标识")}</th>
              {!subtable && <th>{t("风险数")}</th>}
              <th>{t("迁移资格")}</th>
              <th>{t(subtable ? "本项策略" : "当前策略")}</th>
              {!subtable && <th>{t("处理进度")}</th>}
              <th>{t("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, risks: items }) => {
              const open = onExpandVm
                ? expandedVm === key
                : expanded.includes(key);
              const eligible = allRisks
                .filter((r) => vmKey(r) === key)
                .every(riskReadyForExecution);
              const labels = [...new Set(items.map(strategyLabel))];
              return (
                <Fragment key={key}>
                  <tr
                    ref={expandedVm === key ? selectedRow : undefined}
                    data-selected={
                      selected.size > 0 && items.some((r) => selected.has(r.id))
                    }
                  >
                    {selectable && (
                      <td>
                        <SelectionCheckbox
                          label={t("选择虚拟机 {0}", items[0].vmName)}
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
                    )}
                    <th scope="row">
                      <strong>{items[0].vmName}</strong>
                    </th>
                    <td data-label={t("标识")}>{items[0].vmId || "—"}</td>
                    {!subtable && (
                      <td data-label={t("风险数")}>{items.length}</td>
                    )}
                    <td data-label={t("迁移资格")}>
                      <span
                        className={styles.impact}
                        data-impact={eligible ? "constraint" : "blocked"}
                      >
                        {t(eligible ? "可纳入" : "暂时排除")}
                      </span>
                    </td>
                    <td data-label={t(subtable ? "本项策略" : "当前策略")}>
                      {t(labels.length === 1 ? labels[0] : "含多项策略")}
                    </td>
                    {!subtable && (
                      <td data-label={t("处理进度")}>
                        {t(
                          "已选 {0} / {1}",
                          items.filter(hasRiskDecision).length,
                          items.length,
                        )}
                      </td>
                    )}
                    <td data-actions>
                      <div className={styles.rowActions}>
                        <button
                          className={styles.textAction}
                          aria-expanded={open}
                          disabled={actions.navigationLocked}
                          onClick={() => toggle(key, open)}
                        >
                          {t(readOnly ? "查看依据" : "查看详情")}
                        </button>
                        {readOnly && (
                          <button
                            className={styles.textAction}
                            disabled={actions.saving || actions.editing}
                            onClick={() =>
                              actions.onManage?.({ mode: "vm", vmKey: key })
                            }
                          >
                            {t("单独处理")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={columns}>
                        {!readOnly && (
                          <div className={styles.sectionHeading}>
                            <p>{t("仅调整这台虚拟机当前筛选出的风险。")}</p>
                            <Button
                              disabled={
                                !actions.editable ||
                                actions.saving ||
                                actions.editing ||
                                !items.some((r) => r.stage === "research")
                              }
                              onClick={() =>
                                actions.onEdit(`vm:${key}`, items, true)
                              }
                            >
                              {t("批量调整策略")}
                            </Button>
                          </div>
                        )}
                        {actions.inlineEditor?.key === `vm:${key}` &&
                          actions.inlineEditor.content}
                        <RiskVmDetails
                          risks={items}
                          readOnly={readOnly}
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
        label={t("{0}分页", label)}
        total={groups.length}
        value={pagination}
        onChange={onPage}
        disabled={actions.navigationLocked}
      />
    </div>
  );
}
