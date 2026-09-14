import { Fragment, useEffect, useRef, useState } from "react";
import type { RiskItem } from "@/domain/models";
import { hasRiskDecision, riskReadyForExecution } from "@/domain/assessment";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
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
  const columns = selectable ? 5 : 4;
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
        <table className={`${styles.table} ${styles.vmTable}`}>
          <colgroup>
            {selectable && <col className={styles.checkboxColumn} />}
            <col style={{ width: "34%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "23%" }} />
            <col />
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
                      !pageRisks.some((r) => r.stage === "research")
                    }
                    onChange={(checked) => onSelect(pageRisks, checked)}
                  />
                </th>
              )}
              <th>{t("虚拟机名称／标识")}</th>
              <th>{t("迁移资格")}</th>
              <th>{t("当前策略")}</th>
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
                            !items.some((r) => r.stage === "research")
                          }
                          onChange={(checked) => onSelect(items, checked)}
                        />
                      </td>
                    )}
                    <th scope="row">
                      <strong>{items[0].vmName}</strong>
                      <small>
                        {items[0].vmId} · {t("{0} 条风险", items.length)}
                      </small>
                    </th>
                    <td>
                      <span
                        className={styles.impact}
                        data-impact={eligible ? "constraint" : "blocked"}
                      >
                        {t(eligible ? "可纳入" : "暂时排除")}
                      </span>
                    </td>
                    <td>
                      {t(labels.length === 1 ? labels[0] : "含多项策略")}
                      <small>
                        {t(
                          "已选 {0} / {1}",
                          items.filter(hasRiskDecision).length,
                          items.length,
                        )}
                      </small>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          className={styles.textAction}
                          aria-expanded={open}
                          disabled={actions.saving}
                          onClick={() => toggle(key, open)}
                        >
                          <Icon name={open ? "chevron" : "right"} size={12} />
                          {t(readOnly ? "查看依据" : "查看与处理")}
                        </button>
                        {readOnly && (
                          <button
                            className={styles.textAction}
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
                        {!readOnly && actions.editorFor(`vm:${key}`)}
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
        label={t("{0}分页", label)}
        total={groups.length}
        value={pagination}
        onChange={onPage}
        disabled={actions.saving}
      />
    </div>
  );
}
