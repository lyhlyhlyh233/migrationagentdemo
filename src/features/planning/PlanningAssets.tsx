import { businessGradeLabels } from "@/shared/i18n/planning";
import { useMemo } from "react";
import type { PlanningAsset } from "@/domain/planning";

import { useTranslation } from "@/shared/i18n";
import { migrationMethodLabels } from "@/shared/i18n/risks";
import { Button } from "@/shared/ui/primitives";
import { Pagination } from "@/shared/ui/Pagination";
import { SelectionCheckbox } from "@/shared/ui/SelectionCheckbox";
import { Select } from "@/shared/ui/Select";
import { pageWindow } from "@/shared/ui/pagination-state";
import type { PlanningView } from "./state";
import styles from "./Planning.module.css";
export function PlanningAssets({
  assets,
  view,
  onView,
  locked,
  attributes = false,
}: {
  assets: PlanningAsset[];
  view: PlanningView;
  onView: (patch: Partial<PlanningView>) => void;
  locked: boolean;
  attributes?: boolean;
}) {
  const t = useTranslation();
  const filtered = useMemo(
    () =>
      assets.filter(
        (a) =>
          (!attributes ||
            view.systemFocus === undefined ||
            a.system === view.systemFocus) &&
          `${a.name} ${a.id} ${a.system}`
            .toLowerCase()
            .includes(view.query.toLowerCase()) &&
          (!view.grade ||
            (view.grade === "missing"
              ? !a.system || !a.grade
              : a.grade === view.grade)),
      ),
    [assets, view.query, view.grade, view.systemFocus, attributes],
  );
  const page = pageWindow(filtered.length, view.assetPage);
  const rows = filtered.slice(page.start, page.end);
  const selected = new Set(view.selected);
  const pageCount = rows.filter((a) => selected.has(a.id)).length;
  const toggle = (ids: string[], checked: boolean) => {
    const next = new Set(view.selected);
    ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
    onView({ selected: [...next] });
  };
  return (
    <>
      {attributes && view.systemFocus !== undefined && (
        <div className={styles.selection}>
          <span>
            {t("当前业务系统")}：{view.systemFocus || t("待补充")}
          </span>
          <Button
            onClick={() =>
              onView({
                systemFocus: undefined,
                selected: [],
                assetPage: { ...view.assetPage, page: 1 },
              })
            }
          >
            {t("查看全部虚拟机")}
          </Button>
        </div>
      )}
      <div className={styles.filters}>
        <input
          aria-label={t("搜索虚拟机或业务系统")}
          placeholder={t("搜索虚拟机或业务系统")}
          value={view.query}
          disabled={locked}
          onChange={(e) =>
            onView({
              query: e.target.value,
              assetPage: { ...view.assetPage, page: 1 },
              selected: [],
            })
          }
        />
        <Select
          aria-label={t("业务等级")}
          value={view.grade}
          disabled={locked}
          onValueChange={(grade) =>
            onView({
              grade,
              assetPage: { ...view.assetPage, page: 1 },
              selected: [],
            })
          }
        >
          <option value="">{t("全部业务等级")}</option>
          <option value="missing">{t("业务资料待补充")}</option>
          {(["general", "important", "critical"] as const).map((grade) => (
            <option key={grade} value={grade}>
              {t(businessGradeLabels[grade])}
            </option>
          ))}
        </Select>
      </div>
      <div className={styles.selection}>
        <span>{t("已选 {0} 台", view.selected.length)}</span>
        <Button
          disabled={locked || !filtered.length}
          onClick={() =>
            toggle(
              filtered.map((a) => a.id),
              true,
            )
          }
        >
          {t("选择全部筛选结果 {0} 台", filtered.length)}
        </Button>
        <Button
          disabled={locked || !view.selected.length}
          onClick={() => onView({ selected: [] })}
        >
          {t("清空选择")}
        </Button>
      </div>
      <table className={`${styles.table} ${styles.assets}`}>
        <thead>
          <tr>
            <th className={styles.check}>
              <SelectionCheckbox
                label={t("选择本页虚拟机")}
                checked={rows.length > 0 && pageCount === rows.length}
                mixed={pageCount > 0 && pageCount < rows.length}
                disabled={locked}
                onChange={(checked) =>
                  toggle(
                    rows.map((a) => a.id),
                    checked,
                  )
                }
              />
            </th>
            <th>{t("虚拟机 / 标识")}</th>
            <th>{t("业务系统")}</th>
            <th>{t("业务等级")}</th>
            <th>{t(attributes ? "集群 / 角色" : "配置 / 迁移方式")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} data-selected={selected.has(a.id)}>
              <td>
                <SelectionCheckbox
                  label={t("选择 {0}", a.name)}
                  checked={selected.has(a.id)}
                  disabled={locked}
                  onChange={(checked) => toggle([a.id], checked)}
                />
              </td>
              <td>
                <strong>{a.name}</strong>
                <details>
                  <summary>{t("查看标识与评估")}</summary>
                  <small>{a.id}</small>
                  <small>
                    {a.os} · {a.riskScore} {t("风险总分")}
                  </small>
                  <small>{t(a.strategy)}</small>
                </details>
              </td>
              <td>{a.system || t("待补充")}</td>
              <td>{t(businessGradeLabels[a.grade])}</td>
              <td>
                {attributes ? (
                  `${a.clusterType || "—"} / ${a.clusterRole || "—"}`
                ) : (
                  <>
                    {a.cpu} vCPU · {a.memory} GB
                    <small>
                      {a.storage} GB · {t(migrationMethodLabels[a.method])}
                    </small>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className={styles.empty}>{t("没有匹配的虚拟机")}</p>}
      <Pagination
        total={filtered.length}
        value={view.assetPage}
        onChange={(assetPage) => onView({ assetPage })}
        label={t("规划虚拟机")}
        sizes={[20, 50, 100]}
        compact
      />
    </>
  );
}
