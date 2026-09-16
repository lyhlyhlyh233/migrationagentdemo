import type { ProjectSnapshot } from "@/domain/models";
import {
  planningSummary,
  planningWarnings,
  planningIsStale,
} from "@/domain/planning";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { PlanningTimeline } from "./PlanningTimeline";
import styles from "./Planning.module.css";
export function PlanningSummary({
  snapshot: s,
  onDownload,
  demoTools = false,
}: {
  snapshot: ProjectSnapshot;
  onDownload: (id: string) => void;
  demoTools?: boolean;
}) {
  const t = useTranslation(),
    p = s.planning!,
    sum = planningSummary(p),
    warnings = planningWarnings(p),
    stale = planningIsStale(s);
  return (
    <section className={styles.dashboard} aria-label={t("规划结果看板")}>
      <header className={styles.dashboardHeader}>
        <h2>{t("整体规划结论")}</h2>
        <button
          type="button"
          className={styles.textAction}
          onClick={() => onDownload("batch-plan")}
        >
          <Icon name="download" size={14} />
          {t("导出规划")}
        </button>
      </header>
      <p>
        {t(
          "先安排试点，再扩展到核心业务与规模迁移。受阻对象继续排除；时间与依赖仍需人工核对。",
        )}
      </p>
      <div className={styles.assessmentStatus}>
        <span>{t("售后评估状态")}</span>
        <strong data-tone={warnings.length ? "warning" : "success"}>
          {t(
            warnings.length
              ? demoTools
                ? "示例检查：存在待核对事项"
                : "存在待核对事项"
              : demoTools
                ? "示例检查完成"
                : "规划检查完成",
          )}
        </strong>
        {stale && <small data-tone="warning">{t("待更新")}</small>}
      </div>
      <dl className={styles.dashboardMetrics}>
        {[
          ["批次总数", p.batches.length],
          ["预计总迁移周期", `${sum.days} ${t("天")}`],
          ["预计总停机时长", `${sum.downtime} h`],
          ["售前可迁移VM数", p.baselineEligibleIds.length],
          ["售后输入批次VM数", sum.included],
          ["排除VM数", sum.excluded],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{t(String(label))}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {!!warnings.length && (
        <details className={styles.warnings}>
          <summary>
            {t("待核对事项")} · {warnings.length}
          </summary>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{t(w)}</li>
            ))}
          </ul>
        </details>
      )}
      <section className={styles.dashboardSection}>
        <h3>{t("批次甘特图")}</h3>
        <PlanningTimeline planning={p} demoTools={demoTools} />
      </section>
      <p className={styles.note}>
        {t(
          s.batchConfirmation === "confirmed"
            ? "规划已交接，当前只读。"
            : "需要调整时，请在对话中说明要求或附加资料，确认预览后更新。",
        )}
      </p>
    </section>
  );
}
