import { useMemo } from "react";
import type { PlanningAsset } from "@/domain/planning";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { SelectionCheckbox } from "@/shared/ui/SelectionCheckbox";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow } from "@/shared/ui/pagination-state";
import type { PlanningView } from "./state";
import styles from "./Planning.module.css";

export function PlanningSystems({
  assets,
  view,
  onView,
  locked,
}: {
  assets: PlanningAsset[];
  view: PlanningView;
  onView: (patch: Partial<PlanningView>) => void;
  locked: boolean;
}) {
  const t = useTranslation();
  const groups = useMemo(() => {
    const bySystem = new Map<string, PlanningAsset[]>();
    for (const a of assets) {
      if (!a.system.toLowerCase().includes(view.query.toLowerCase())) continue;
      const group = bySystem.get(a.system) ?? [];
      group.push(a);
      bySystem.set(a.system, group);
    }
    return [...bySystem].map(([system, members]) => ({ system, members }));
  }, [assets, view.query]);
  const page = pageWindow(groups.length, view.assetPage);
  const rows = groups.slice(page.start, page.end);
  const selected = new Set(view.selected);
  const toggle = (ids: string[], checked: boolean) => {
    const next = new Set(selected);
    ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
    onView({ selected: [...next] });
  };
  const pageIds = rows.flatMap((g) => g.members.map((a) => a.id));
  const checkedCount = pageIds.filter((id) => selected.has(id)).length;
  return (
    <>
      <div className={styles.filters}>
        <input
          aria-label={t("搜索业务系统")}
          placeholder={t("搜索业务系统")}
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
      </div>
      <div className={styles.selection}>
        <span>{t("已选 {0} 台", selected.size)}</span>
        <Button
          disabled={locked || !groups.length}
          onClick={() =>
            toggle(
              groups.flatMap((g) => g.members.map((a) => a.id)),
              true,
            )
          }
        >
          {t("选择全部筛选结果")}
        </Button>
        <Button
          disabled={locked || !selected.size}
          onClick={() => onView({ selected: [] })}
        >
          {t("清空选择")}
        </Button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.check}>
              <SelectionCheckbox
                label={t("选择本页业务系统")}
                checked={pageIds.length > 0 && checkedCount === pageIds.length}
                mixed={checkedCount > 0 && checkedCount < pageIds.length}
                disabled={locked}
                onChange={(checked) => toggle(pageIds, checked)}
              />
            </th>
            <th>{t("业务系统")}</th>
            <th>{t("虚拟机")}</th>
            <th>{t("业务资料待补充")}</th>
            <th>{t("操作")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const ids = g.members.map((a) => a.id);
            const count = ids.filter((id) => selected.has(id)).length;
            return (
              <tr key={g.system}>
                <td>
                  <SelectionCheckbox
                    label={t("选择 {0}", g.system || t("待补充"))}
                    checked={count === ids.length}
                    mixed={count > 0 && count < ids.length}
                    disabled={locked}
                    onChange={(checked) => toggle(ids, checked)}
                  />
                </td>
                <td>{g.system || t("待补充")}</td>
                <td>{ids.length}</td>
                <td>{g.members.filter((a) => !a.system || !a.grade).length}</td>
                <td>
                  <Button
                    onClick={() =>
                      onView({
                        assetMode: "vms",
                        systemFocus: g.system,
                        query: "",
                        grade: "",
                        assetPage: { ...view.assetPage, page: 1 },
                        selected: [],
                      })
                    }
                  >
                    {t("查看虚拟机")}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination
        total={groups.length}
        value={view.assetPage}
        onChange={(assetPage) => onView({ assetPage })}
        sizes={[20, 50, 100]}
        label={t("业务系统")}
        compact
      />
    </>
  );
}
