import { planningPhaseLabels } from "@/shared/i18n/planning";
import { Fragment, useMemo } from "react";
import type { PlanningState } from "@/domain/planning";
import { resourceTotals } from "@/domain/planning";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
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
  confirmed,
}: {
  planning: PlanningState;
  view: PlanningView;
  onView: (patch: Partial<PlanningView>) => void;
  locked: boolean;
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
            })
          }
        />
      </div>
      <table className={`${styles.table} ${styles.batches}`}>
        <thead>
          <tr>
            <th>{t("批次 / 阶段")}</th>
            <th>{t("虚拟机")}</th>
            <th>{t("资源需求")}</th>
            <th>{t("割接时间 / 停机")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const members = b.assetIds.flatMap((id) => byId.get(id) ?? []);
            const total = resourceTotals(members);
            const expanded = view.expandedBatch === b.id;
            return (
              <Fragment key={b.id}>
                <tr>
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
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={4} className={styles.subtable}>
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
                        readOnly
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
    </>
  );
}
