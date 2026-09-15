import { planningPhaseLabels } from "@/shared/i18n/planning";
import { Fragment, useMemo } from "react";
import type { PlanningState, PlanningAdjustment } from "@/domain/planning";
import { resourceTotals } from "@/domain/planning";
import { useTranslation } from "@/shared/i18n";
import { Button, Field } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/Select";
import { SelectionCheckbox } from "@/shared/ui/SelectionCheckbox";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow } from "@/shared/ui/pagination-state";
import { PlanningAssets } from "./PlanningAssets";
import type { PlanningView } from "./state";
import styles from "./Planning.module.css";
export function PlanningBatches({
  planning: p,
  view,
  onView,
  locked,
  onPreview,
  confirmed,
}: {
  planning: PlanningState;
  view: PlanningView;
  onView: (patch: Partial<PlanningView>) => void;
  locked: boolean;
  onPreview: (change: PlanningAdjustment) => Promise<void>;
  confirmed: boolean;
}) {
  const t = useTranslation();
  const byId = useMemo(
    () => new Map(p.assets.map((a) => [a.id, a])),
    [p.assets],
  );
  const batches = p.batches.filter(
    (b) =>
      !view.batchQuery ||
      `${b.id} ${planningPhaseLabels[b.phase]}`
        .toLowerCase()
        .includes(view.batchQuery.toLowerCase()),
  );
  const page = pageWindow(batches.length, view.batchPage);
  const rows = batches.slice(page.start, page.end);
  const selected = new Set(view.batchSelected);
  const pageCount = rows.filter((b) => selected.has(b.id)).length;
  const toggle = (ids: string[], checked: boolean) => {
    const next = new Set(view.batchSelected);
    ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
    onView({ batchSelected: [...next] });
  };
  return (
    <>
      <div className={styles.filters}>
        <input
          aria-label={t("搜索批次")}
          placeholder={t("搜索批次")}
          disabled={locked}
          value={view.batchQuery ?? ""}
          onChange={(e) =>
            onView({
              batchQuery: e.target.value,
              batchPage: { ...view.batchPage, page: 1 },
              batchSelected: [],
            })
          }
        />
        <span>{t("已选 {0} 个批次", view.batchSelected.length)}</span>
        <Button
          disabled={locked}
          onClick={() =>
            toggle(
              batches.map((b) => b.id),
              true,
            )
          }
        >
          {t("选择全部筛选结果")}
        </Button>
        <Button
          disabled={locked || !selected.size}
          onClick={() => onView({ batchSelected: [] })}
        >
          {t("清空选择")}
        </Button>
      </div>
      <table className={`${styles.table} ${styles.batches}`}>
        <thead>
          <tr>
            <th className={styles.check}>
              <SelectionCheckbox
                label={t("选择本页批次")}
                checked={rows.length > 0 && pageCount === rows.length}
                mixed={pageCount > 0 && pageCount < rows.length}
                disabled={locked}
                onChange={(checked) =>
                  toggle(
                    rows.map((b) => b.id),
                    checked,
                  )
                }
              />
            </th>
            <th>{t("批次 / 阶段")}</th>
            <th>{t("虚拟机")}</th>
            <th>{t("资源需求")}</th>
            <th>{t("割接时间 / 停机")}</th>
            <th>{t("操作")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const members = b.assetIds.flatMap((id) => byId.get(id) ?? []);
            const total = resourceTotals(members);
            const expanded = view.expandedBatch === b.id;
            return (
              <Fragment key={b.id}>
                <tr data-selected={selected.has(b.id)}>
                  <td>
                    <SelectionCheckbox
                      label={t("选择 {0}", b.id)}
                      checked={selected.has(b.id)}
                      disabled={locked}
                      onChange={(checked) => toggle([b.id], checked)}
                    />
                  </td>
                  <td>
                    <strong>{b.id}</strong>
                    <small>{t(planningPhaseLabels[b.phase])}</small>
                  </td>
                  <td>
                    <Button
                      aria-expanded={expanded}
                      onClick={() =>
                        onView({
                          expandedBatch: expanded ? undefined : b.id,
                          assetPage:
                            view.expandedBatch === b.id
                              ? view.assetPage
                              : { ...view.assetPage, page: 1 },
                          query: "",
                          grade: "",
                        })
                      }
                    >
                      {b.assetIds.length} {t("台")}
                    </Button>
                  </td>
                  <td>
                    {total.cpu} vCPU
                    <small>
                      {total.memory} / {total.storage} GB
                    </small>
                  </td>
                  <td>
                    {b.cutover.replace("T", " ")}
                    <small>
                      {b.downtime} h · {t(confirmed ? "已确认" : "待确认")}
                    </small>
                  </td>
                  <td>
                    <Button
                      disabled={locked}
                      onClick={() =>
                        onView({
                          batchSelected: [b.id],
                          cutover: b.cutover,
                          bufferDays: b.bufferDays,
                        })
                      }
                    >
                      {t("调整")}
                    </Button>
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={6} className={styles.subtable}>
                      <div className={styles.batchMeta}>
                        <span>
                          {t("全量同步开始")} {b.start.replace("T", " ")}
                        </span>
                        <span>
                          {t("缓冲")} {b.bufferDays} {t("天")}
                        </span>
                        <span>
                          {t("割接窗口")} {b.window}
                        </span>
                        <span>
                          {t("风险总分")}{" "}
                          {members.reduce((sum, a) => sum + a.riskScore, 0)}
                        </span>
                      </div>
                      <PlanningAssets
                        assets={members}
                        view={view}
                        onView={onView}
                        locked={locked}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <Pagination
        total={batches.length}
        value={view.batchPage}
        onChange={(batchPage) => onView({ batchPage })}
        sizes={[20, 50, 100]}
        label={t("迁移批次")}
        compact
      />
      {!!view.batchSelected.length && (
        <form
          className={styles.editor}
          onSubmit={(e) => {
            e.preventDefault();
            void onPreview({
              kind: "window",
              batchIds: view.batchSelected,
              cutover:
                view.cutover ??
                p.batches.find((b) => selected.has(b.id))!.cutover,
              bufferDays: view.bufferDays ?? 1,
            });
          }}
        >
          <strong>{t("调整所选批次窗口")}</strong>
          <div className={styles.fields}>
            <Field
              label={t("割接切换时间")}
              type="datetime-local"
              required
              value={
                view.cutover ??
                p.batches.find((b) => selected.has(b.id))?.cutover ??
                ""
              }
              disabled={locked}
              onChange={(e) => onView({ cutover: e.target.value })}
            />
            <Field
              label={t("批次缓冲天数")}
              type="number"
              min={0}
              max={365}
              value={view.bufferDays ?? 1}
              disabled={locked}
              onChange={(e) => onView({ bufferDays: Number(e.target.value) })}
            />
          </div>
          <Button primary type="submit" disabled={locked}>
            {t("预览调整")}
          </Button>
        </form>
      )}
      {!!view.selected.length && (
        <div className={styles.editor}>
          <strong>{t("移动所选 {0} 台虚拟机", view.selected.length)}</strong>
          <div className={styles.actions}>
            <Select
              aria-label={t("目标批次")}
              disabled={locked}
              value={view.targetBatch ?? p.batches[0]?.id}
              onValueChange={(targetBatch) => onView({ targetBatch })}
            >
              {p.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id}
                </option>
              ))}
            </Select>
            <Button
              primary
              disabled={locked}
              onClick={() =>
                void onPreview({
                  kind: "move",
                  assetIds: view.selected,
                  targetBatchId: view.targetBatch ?? p.batches[0].id,
                })
              }
            >
              {t("预览批次调整")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
