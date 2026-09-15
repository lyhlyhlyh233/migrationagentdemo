import { useId, useMemo, useState } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import { riskOverview } from "@/domain/assessment";
import { useTranslation } from "@/shared/i18n";
import { riskCategoryLabels } from "@/shared/i18n/risks";
import { Icon } from "@/shared/ui/icons";
import styles from "./RiskOverview.module.css";

const percent = (share: number) => `${Number((share * 100).toFixed(1))}%`;

export function RiskOverview({
  snapshot,
  editing,
}: {
  snapshot: ProjectSnapshot;
  editing: boolean;
}) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const chartId = useId();
  const data = useMemo(() => riskOverview(snapshot), [snapshot]);
  const showCharts = expanded && !editing && data.ready && data.total > 0;
  const includedShare = data.total ? data.included / data.total : 0;
  const excludedShare = data.total ? data.excluded / data.total : 0;
  const scopeLabel = t("项目总体 · 不随列表筛选变化");
  const breakdownLabel = t(
    "仅统计当前导致排除的风险，同一虚拟机可涉及多条。占比按风险条数计算并四舍五入。",
  );
  return (
    <section className={styles.root} aria-label={t("风险概览")}>
      <div className={styles.heading}>
        <span title={scopeLabel}>{t("项目总体")}</span>
        {data.ready && (
          <span>
            {t("未选策略")} <strong>{data.undecided}</strong>
          </span>
        )}
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={showCharts}
          aria-controls={chartId}
          disabled={editing || !data.ready || !data.total}
          title={editing ? t("编辑策略时暂时收起概览") : undefined}
          onClick={() => setExpanded(!expanded)}
        >
          {t(showCharts ? "收起概览" : "展开概览")}
          <Icon name="chevron" size={14} />
        </button>
      </div>
      {!data.ready ? (
        <p className={styles.empty}>
          {t("待评估，完成后显示迁移范围与排除风险。")}
        </p>
      ) : !data.total ? (
        <p className={styles.empty}>{t("当前范围内没有虚拟机。")}</p>
      ) : !showCharts ? (
        <div className={styles.compact} title={scopeLabel}>
          <span>
            {t("虚拟机总数")} <strong>{data.total}</strong>
          </span>
          <span>
            {t("可纳入")} <strong data-tone="success">{data.included}</strong>
          </span>
          <span>
            {t("暂时排除")} <strong data-tone="warning">{data.excluded}</strong>
          </span>
        </div>
      ) : null}
      <div
        id={chartId}
        hidden={!showCharts}
        className={styles.charts}
        role="group"
        aria-label={t("风险统计图")}
        tabIndex={0}
      >
        <figure className={styles.scope} aria-label={t("虚拟机迁移范围")}>
          <figcaption>{t("虚拟机迁移范围")}</figcaption>
          <div className={styles.scopeBody}>
            <div className={styles.ring}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="42" className={styles.track} />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  pathLength="100"
                  className={styles.included}
                  strokeDasharray={`${includedShare * 100} 100`}
                  transform="rotate(-90 50 50)"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  pathLength="100"
                  className={styles.excluded}
                  strokeDasharray={`${excludedShare * 100} 100`}
                  strokeDashoffset={-includedShare * 100}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className={styles.ringCenter}>
                <strong>{data.total}</strong>
                <span>{t("台虚拟机")}</span>
              </div>
            </div>
            <dl className={styles.legend}>
              <div>
                <dt>
                  <i data-tone="success" />
                  {t("可纳入")}
                </dt>
                <dd>
                  <strong data-tone="success">{data.included}</strong>
                  <span>{percent(includedShare)}</span>
                </dd>
              </div>
              <div>
                <dt>
                  <i data-tone="warning" />
                  {t("暂时排除")}
                </dt>
                <dd>
                  <strong data-tone="warning">{data.excluded}</strong>
                  <span>{percent(excludedShare)}</span>
                </dd>
              </div>
            </dl>
          </div>
          <p className={styles.note}>{t("按虚拟机去重，受阻对象自动排除")}</p>
        </figure>
        <figure className={styles.distribution} aria-label={t("排除风险分布")}>
          <figcaption title={breakdownLabel}>
            {t("排除风险分布")}
            <Icon name="info" size={13} />
          </figcaption>
          {data.excluded ? (
            <>
              <p className={styles.note}>
                {t(
                  "涉及 {0} 台虚拟机、{1} 条排除风险",
                  data.excluded,
                  data.exclusionRisks,
                )}
              </p>
              <ul className={styles.bars} aria-label={breakdownLabel}>
                {data.categories.map((row) => {
                  const label = t(
                    row.category === "other"
                      ? "其他风险"
                      : riskCategoryLabels[row.category],
                  );
                  return (
                    <li key={row.category}>
                      <span className={styles.category} title={label}>
                        {label}
                      </span>
                      <span className={styles.bar} aria-hidden="true">
                        <i style={{ width: `${row.share * 100}%` }} />
                      </span>
                      <span className={styles.value}>
                        <strong>
                          {row.count === 1 ? t("1 条") : t("{0} 条", row.count)}
                        </strong>
                        <span>{percent(row.share)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className={styles.clear}>
              <Icon name="check" size={18} />
              {t("当前无排除对象")}
            </p>
          )}
        </figure>
      </div>
    </section>
  );
}
