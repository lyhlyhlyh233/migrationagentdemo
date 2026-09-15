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
}: {
  planning: PlanningState;
  view: PlanningView;
  onView: (patch: Partial<PlanningView>) => void;
  onSave: (patch: PlanningInputPatch) => Promise<void>;
  locked: boolean;
}) {
  const t = useTranslation();
  const capacity = view.capacityDraft ?? p.capacity;
  const summary = planningSummary(p);
  const assets = new Map(p.assets.map((a) => [a.id, a]));
  const cumulative = { cpu: 0, memory: 0, storage: 0 };
  return (
    <>
      <div className={styles.sectionTitle}>
        <strong>{t("目标资源与预留")}</strong>
        <span>{t("资源单位：GB")}</span>
      </div>
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
                  capacityDraft: { ...capacity, [key]: Number(e.target.value) },
                  draftRevision: view.draftRevision ?? p.revision,
                })
              }
            />
          ))}
        </div>
        <Button primary type="submit" disabled={locked || !view.capacityDraft}>
          {t("保存资源条件")}
        </Button>
      </form>
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
                {used.toLocaleString()}
              </span>
              <progress
                max={Math.max(available, used, 1)}
                value={used}
                aria-label={t("{0}占用", t(label))}
              />
              <span data-tone={used > available ? "danger" : "success"}>
                {t("迁移后剩余")} {(available - used).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
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
  return (
    <div className={styles.timeline}>
      <p className={styles.note}>
        {t("模拟排程。点击批次查看虚拟机明细；日期与窗口需人工核对。")}
      </p>
      <div className={styles.timelineScale}>
        <span>{new Date(start).toISOString().slice(0, 10)}</span>
        <span>{new Date(start + span / 2).toISOString().slice(5, 10)}</span>
        <span>{new Date(end).toISOString().slice(0, 10)}</span>
      </div>
      {p.batches.map((b) => (
        <div className={styles.timelineRow} key={b.id}>
          <button type="button" onClick={() => onBatch(b.id)}>
            {b.id}
            <small>
              {b.assetIds.length} {t("台")}
            </small>
          </button>
          <button
            type="button"
            className={styles.track}
            onClick={() => onBatch(b.id)}
            aria-label={`${b.id}: ${b.start} → ${b.end}`}
            title={`${b.start.replace("T", " ")} → ${b.end.replace("T", " ")}`}
          >
            <span
              className={styles.syncBar}
              style={{
                left: `${((planningTime(b.start) - start) / span) * 100}%`,
                width: `${((planningTime(b.cutover) - planningTime(b.start)) / span) * 100}%`,
              }}
            />
            <span
              className={styles.validationBar}
              style={{
                left: `${((planningTime(b.cutover) - start) / span) * 100}%`,
                width: `${((planningTime(b.end) - planningTime(b.cutover)) / span) * 100}%`,
              }}
            />
            <span
              className={styles.cutoverMark}
              style={{
                left: `${((planningTime(b.cutover) - start) / span) * 100}%`,
              }}
            />
          </button>
        </div>
      ))}
      <div className={styles.legend}>
        <span data-tone="info">● {t("全量同步")}</span>
        <span data-tone="warning">● {t("割接")}</span>
        <span data-tone="success">● {t("业务验证与缓冲")}</span>
      </div>
    </div>
  );
}
