import type { PlanningState } from "@/domain/planning";
import { planningTime } from "@/domain/planning";
import { useTranslation } from "@/shared/i18n";
import { planningPhaseLabels } from "@/shared/i18n/planning";
import styles from "./Planning.module.css";

export function PlanningTimeline({
  planning: p,
  demoTools = false,
}: {
  planning: PlanningState;
  demoTools?: boolean;
}) {
  const t = useTranslation();
  if (!p.batches.length)
    return <p className={styles.empty}>{t("生成规划后查看时间线")}</p>;
  const start = Math.min(...p.batches.map((b) => planningTime(b.start)));
  const end = Math.max(...p.batches.map((b) => planningTime(b.end)));
  const span = Math.max(end - start, 86400000);
  const day = 86400000;
  const ticks = Array.from({ length: 9 }, (_, i) => start + (span * i) / 8);
  const gridLines = Array.from(
    { length: Math.ceil(span / day) },
    (_, i) => Math.floor(start / day) * day + (i + 1) * day,
  ).filter((time) => time < end);
  return (
    <div className={styles.timeline}>
      {demoTools && <p className={styles.note}>{t("模拟排程")}</p>}
      <table className={styles.timelineTable} aria-label={t("批次甘特图")}>
        <colgroup>
          <col className={styles.batchColumn} />
          <col className={styles.countColumn} />
          <col className={styles.durationColumn} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{t("批次")}</th>
            <th scope="col">VM</th>
            <th scope="col">{t("周期")}</th>
            <th scope="col" aria-label={t("迁移时间线")}>
              <div className={styles.timelineScale}>
                {ticks.map((time, i) => (
                  <span
                    key={i}
                    data-tick={i}
                    style={{ left: `${(i / 8) * 100}%` }}
                    title={new Date(time).toISOString().slice(0, 10)}
                  >
                    {new Date(time).toISOString().slice(5, 10)}
                  </span>
                ))}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {p.batches.map((b) => {
            const batchStart = planningTime(b.start);
            const cutover = planningTime(b.cutover);
            const batchEnd = planningTime(b.end);
            const validation = Math.min(
              p.conditions.validationHours * 3600000,
              Math.max(0, batchEnd - cutover),
            );
            const description = `${b.id} · ${t(planningPhaseLabels[b.phase])} · ${b.assetIds.length} ${t("台")} · ${b.window} · ${b.start.replace("T", " ")} → ${b.end.replace("T", " ")}`;
            return (
              <tr className={styles.timelineRow} key={b.id}>
                <th scope="row">
                  <span title={description}>{b.id}</span>
                </th>
                <td>{b.assetIds.length}</td>
                <td>
                  {Math.round(((batchEnd - batchStart) / day) * 10) / 10}{" "}
                  {t("天")}
                </td>
                <td>
                  <div
                    className={styles.track}
                    role="img"
                    aria-label={description}
                    title={description}
                  >
                    {gridLines.map((time) => (
                      <span
                        key={time}
                        className={styles.gridLine}
                        aria-hidden="true"
                        style={{ left: `${((time - start) / span) * 100}%` }}
                      />
                    ))}
                    <span
                      className={styles.syncBar}
                      style={{
                        left: `${((batchStart - start) / span) * 100}%`,
                        width: `${((cutover - batchStart) / span) * 100}%`,
                      }}
                    />
                    <span
                      className={styles.bufferBar}
                      style={{
                        left: `${((cutover + validation - start) / span) * 100}%`,
                        width: `${(Math.max(0, batchEnd - cutover - validation) / span) * 100}%`,
                      }}
                    />
                    <span
                      className={styles.validationBar}
                      style={{
                        left: `${((cutover - start) / span) * 100}%`,
                        width: `${(validation / span) * 100}%`,
                      }}
                    />
                    <span
                      className={styles.cutoverMark}
                      style={{ left: `${((cutover - start) / span) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={styles.legend}>
        <span>
          <i data-tone="info" />
          {t("全量同步")}
        </span>
        <span>
          <i data-tone="warning" />
          {t("割接")}
        </span>
        <span>
          <i data-tone="success" />
          {t("业务验证")}
        </span>
        <span>
          <i />
          {t("缓冲")}
        </span>
      </div>
    </div>
  );
}
