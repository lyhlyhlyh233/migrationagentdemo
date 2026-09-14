import { Fragment, useState } from "react";
import type { RiskItem } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { riskImpactLabels, riskStrategyLabels } from "@/shared/i18n/risks";
import { Icon } from "@/shared/ui/icons";
import {
  ruleGroups,
  strategyLabel,
  undecidedRisks,
  vmCount,
} from "./presentation";
import { RiskVmDetails, type RiskInteractions } from "./RiskVmDetails";
import styles from "./RiskPanel.module.css";

export function CategoryRiskTable({
  risks,
  drawer,
  ...actions
}: {
  risks: RiskItem[];
  drawer: boolean;
} & RiskInteractions) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState<string[]>([]);
  return (
    <div
      className={styles.tableScroll}
      role="region"
      aria-label={t("分类风险列表")}
      tabIndex={0}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t("风险事项")}</th>
            <th>{t("迁移影响")}</th>
            <th>{t("受影响虚拟机")}</th>
            <th>{t("当前策略")}</th>
          </tr>
        </thead>
        <tbody>
          {ruleGroups(risks).map(({ key, risks: items }) => {
            const risk = items[0];
            const pending = undecidedRisks(items);
            const labels = [...new Set(items.map(strategyLabel))];
            const open = expanded.includes(key);
            const editor = actions.editorFor(`rule:${key}`);
            const recommendations = new Set(
              items.map((r) => r.recommendedStrategy),
            );
            return (
              <Fragment key={key}>
                <tr>
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
                      onClick={() =>
                        setExpanded(
                          open
                            ? expanded.filter((k) => k !== key)
                            : [...expanded, key],
                        )
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
                    {pending.length > 0 && (
                      <button
                        className={styles.textAction}
                        disabled={!actions.editable || actions.saving}
                        onClick={() =>
                          actions.onEdit(`rule:${key}`, items, true)
                        }
                      >
                        {t("选择策略")}
                      </button>
                    )}
                    {!pending.length && (
                      <small>
                        {t(drawer ? "展开虚拟机查看" : "展开虚拟机调整")}
                      </small>
                    )}
                  </td>
                </tr>
                {editor && (
                  <tr className={styles.expandedRow}>
                    <td colSpan={4}>{editor}</td>
                  </tr>
                )}
                {open && (
                  <tr className={styles.expandedRow}>
                    <td colSpan={4}>
                      <RiskVmDetails
                        risks={items}
                        showVm
                        readOnly={drawer}
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
  );
}
