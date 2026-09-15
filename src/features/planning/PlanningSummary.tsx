import type { ProjectSnapshot } from "@/domain/models";
import {
  planningSummary,
  planningWarnings,
  planningIsStale,
} from "@/domain/planning";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { PlanningTimeline, ResourceForecast } from "./PlanningResources";
import styles from "./Planning.module.css";
export function PlanningSummary({
  snapshot: s,
  onDownload,
  onManage,
  onBatch,
}: {
  snapshot: ProjectSnapshot;
  onDownload: (id: string) => void;
  onManage?: () => void;
  onBatch: (id: string) => void;
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
        <span data-tone={stale ? "warning" : "info"}>
          {t(stale ? "待更新" : "模拟估算")}
        </span>
      </header>
      <p>
        {t(
          "先安排试点，再扩展到核心业务与规模迁移。受阻对象继续排除；时间与依赖仍需人工核对。",
        )}
      </p>
      <dl className={styles.readValues}>
        {[
          [
            "规划状态",
            t(
              s.batchConfirmation === "confirmed"
                ? "已交接 · 只读"
                : stale
                  ? "待更新"
                  : "当前初稿",
            ),
          ],
          ["纳入 / 排除", `${sum.included} / ${sum.excluded}`],
          ["批次数", p.batches.length],
          ["预计周期", `${sum.days} ${t("天")}`],
          ["停机估算", `${sum.downtime} h`],
          ["待核对事项", warnings.length],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{t(String(label))}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <Button primary onClick={onManage}>
          {t("打开迁移规划页面")}
          <Icon name="open" size={14} />
        </Button>
        <Button onClick={() => onDownload("batch-plan")}>
          <Icon name="download" size={14} />
          {t("导出规划")}
        </Button>
      </div>
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
        <PlanningTimeline planning={p} onBatch={onBatch} />
      </section>
      <section className={styles.dashboardSection}>
        <h3>{t("资源预测")}</h3>
        <ResourceForecast planning={p} />
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
