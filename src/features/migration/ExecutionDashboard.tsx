import type { ExecutionState } from "@/domain/execution";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { executionDashboard } from "./execution-dashboard";
import styles from "./ExecutionDashboard.module.css";
export function ExecutionDashboard({
  execution: e,
  onBatch,
  onIssues,
  onManage,
}: {
  execution: ExecutionState;
  onBatch: (id: string) => void;
  onIssues: () => void;
  onManage?: () => void;
}) {
  const t = useTranslation(),
    data = executionDashboard(e),
    total = e.tasks.length;
  const span = Math.max(1000, (data.latest ?? 0) - (data.start ?? 0));
  const time = (v: number) =>
    new Date(v).toLocaleTimeString([], { hour12: false });
  return (
    <section className={styles.root} aria-label={t("任务看板")}>
      <div className={styles.heading}>
        <h3>{t("任务实际状态")}</h3>
        <span>{t("共 {0} 台", total)}</span>
      </div>
      <div className={styles.distribution} aria-hidden="true">
        {data.distribution
          .filter((g) => g.count)
          .map((g) => (
            <span
              key={g.id}
              data-tone={g.tone}
              style={{ width: `${(g.count / Math.max(total, 1)) * 100}%` }}
            />
          ))}
      </div>
      <dl className={styles.states}>
        {data.distribution.map((g) => (
          <div key={g.id}>
            <dt>
              <i data-tone={g.tone} />
              {t(g.label)}
            </dt>
            <dd data-tone={g.tone}>{g.count}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <Button primary onClick={onManage}>
          {t("打开迁移任务页面")}
          <Icon name="open" size={14} />
        </Button>
        <Button onClick={onIssues}>
          {t("查看异常与诊断")}
          <Icon name="right" size={14} />
        </Button>
      </div>
      <div className={styles.heading}>
        <h3>{t("批次实际进度")}</h3>
        <span>
          {data.latest ? t("更新于 {0}", time(data.latest)) : t("尚未启动")}
        </span>
      </div>
      <p className={styles.note}>
        {t(
          "运行区间来自模拟执行记录；颜色表示当前状态，未启动批次不绘制时间条。",
        )}
      </p>
      {data.start !== undefined && (
        <div className={styles.scale}>
          <span>{time(data.start)}</span>
          <span>{time(data.latest!)}</span>
        </div>
      )}
      <div className={styles.rows}>
        {data.batches.map((b) => (
          <div key={b.id} className={styles.row}>
            <button className={styles.batch} onClick={() => onBatch(b.id)}>
              <strong>
                {b.id}
                <Icon name="right" size={13} />
              </strong>
              <span>
                {t(
                  "启动 {0}/{1} · 割接 {2}/{1}",
                  b.started,
                  b.total,
                  b.complete,
                )}
              </span>
              {b.failed > 0 && (
                <span data-tone="danger">{t("异常 {0} 台", b.failed)}</span>
              )}
            </button>
            <div className={styles.track}>
              {b.start === undefined ? (
                <span className={styles.pending}>{t("待执行")}</span>
              ) : (
                <>
                  <span
                    className={styles.bar}
                    data-tone={b.tone}
                    style={{
                      left: `${((b.start - (data.start ?? b.start)) / span) * 100}%`,
                      width: `${Math.max(1, (((b.end ?? b.start) - b.start) / span) * 100)}%`,
                    }}
                  />
                  <span className={styles.status} data-tone={b.tone}>
                    {t(b.label)}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className={styles.note}>{t("割接完成后仍需技术核对与业务验证。")}</p>
    </section>
  );
}
