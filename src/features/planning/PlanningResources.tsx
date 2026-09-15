import { planningPhaseLabels } from "@/shared/i18n/planning";
import { planningTime } from "@/domain/planning";
import type { PlanningState, PlanningInputPatch } from "@/domain/planning";
import { planningSummary, resourceTotals } from "@/domain/planning";
import { useTranslation } from "@/shared/i18n";
import { Button, Field } from "@/shared/ui/primitives";
import type { PlanningView } from "./state";
import styles from "./Planning.module.css";
export function PlanningResources({
  planning: p,
  view,
  onView,
  onSave,
  locked,
  readOnly = false,
}: {
  planning: PlanningState;
  view: PlanningView;
  onView: (patch: Partial<PlanningView>) => void;
  onSave: (patch: PlanningInputPatch) => Promise<void>;
  locked: boolean;
  readOnly?: boolean;
}) {
  const t = useTranslation();
  const capacity = view.capacityDraft ?? p.capacity;
  const assets = new Map(p.assets.map((a) => [a.id, a]));
  const cumulative = { cpu: 0, memory: 0, storage: 0 };
  return (
    <>
      <div className={styles.sectionTitle}>
        <strong>{t("目标资源与预留")}</strong>
        <span>{t("资源单位：GB")}</span>
      </div>
      {!readOnly && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave({ capacity });
          }}
        >
          <div className={styles.fields}>
            {(
              [
                ["cpu", "目标平台 vCPU"],
                ["memory", "目标平台内存(GB)"],
                ["storage", "目标平台存储(GB)"],
                ["reserve", "预留比例(%)"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={t(label)}
                type="number"
                required
                min={key === "reserve" ? 0 : 1}
                max={key === "reserve" ? 99 : undefined}
                value={capacity[key]}
                disabled={locked}
                onChange={(e) =>
                  onView({
                    capacityDraft: {
                      ...capacity,
                      [key]: Number(e.target.value),
                    },
                    draftRevision: view.draftRevision ?? p.revision,
                  })
                }
              />
            ))}
          </div>
          <Button
            primary
            type="submit"
            disabled={locked || !view.capacityDraft}
          >
            {t("保存资源条件")}
          </Button>
        </form>
      )}
      <ResourceForecast planning={p} />
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t("批次")}</th>
            <th>{t("新增 vCPU / GB")}</th>
            <th>{t("累计 vCPU / GB")}</th>
            <th>{t("占用率 CPU / 内存 / 存储")}</th>
          </tr>
        </thead>
        <tbody>
          {p.batches.map((b) => {
            const total = resourceTotals(
              b.assetIds.flatMap((id) => assets.get(id) ?? []),
            );
            cumulative.cpu += total.cpu;
            cumulative.memory += total.memory;
            cumulative.storage += total.storage;
            return (
              <tr key={b.id}>
                <td>
                  {b.id}
                  <small>
                    {b.assetIds.length} {t("台")}
                  </small>
                </td>
                <td>
                  {total.cpu} / {total.memory} / {total.storage}
                </td>
                <td>
                  {cumulative.cpu} / {cumulative.memory} / {cumulative.storage}
                </td>
                <td>
                  {(["cpu", "memory", "storage"] as const)
                    .map(
                      (key) =>
                        `${Math.round((cumulative[key] / (p.capacity[key] * (1 - p.capacity.reserve / 100))) * 100)}%`,
                    )
                    .join(" / ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
export function ResourceForecast({ planning: p }: { planning: PlanningState }) {
  const t = useTranslation(),
    summary = planningSummary(p);
  return (
    <div className={styles.resourceSummary}>
      {(
        [
          ["cpu", "vCPU"],
          ["memory", "内存"],
          ["storage", "存储"],
        ] as const
      ).map(([key, label]) => {
        const available = Math.round(
          p.capacity[key] * (1 - p.capacity.reserve / 100),
        );
        const used = summary.resources[key];
        return (
          <div key={key}>
            <strong>{t(label)}</strong>
            <span>
              {t("可用")} {available.toLocaleString()} · {t("需求")}{" "}
              {used.toLocaleString()} {key === "cpu" ? "vCPU" : "GB"}
            </span>
            <progress
              data-over={used > available || undefined}
              max={Math.max(available, 1)}
              value={Math.min(used, available)}
              aria-label={t("{0}占用", t(label))}
            />
            <span data-tone={used > available ? "danger" : "success"}>
              {t(used > available ? "超出容量" : "迁移后剩余")}{" "}
              {Math.abs(available - used).toLocaleString()}{" "}
              {key === "cpu" ? "vCPU" : "GB"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
export function PlanningTimeline({
  planning: p,
  onBatch,
}: {
  planning: PlanningState;
  onBatch: (id: string) => void;
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
      <p className={styles.note}>{t("模拟排程 · 点击批次查看详情")}</p>
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
                  <button
                    type="button"
                    onClick={() => onBatch(b.id)}
                    title={description}
                  >
                    {b.id}
                  </button>
                </th>
                <td>{b.assetIds.length}</td>
                <td>
                  {Math.round(((batchEnd - batchStart) / day) * 10) / 10}{" "}
                  {t("天")}
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.track}
                    onClick={() => onBatch(b.id)}
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
                  </button>
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
