import type { PlanningState } from "@/domain/planning";
import { planningConditionFields } from "@/shared/i18n/planning";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { PlanningAssets } from "./PlanningAssets";
import { PlanningSystems } from "./PlanningSystems";
import type { PlanningView } from "./state";
import styles from "./Planning.module.css";
export function PlanningReadOnlyInputs({
  planning: p,
  view,
  onView,
}: {
  planning: PlanningState;
  view: PlanningView;
  onView: (v: Partial<PlanningView>) => void;
}) {
  const t = useTranslation();
  return (
    <>
      <nav className={styles.subtabs} aria-label={t("规划资料")}>
        {(
          [
            ["attributes", "业务属性"],
            ["dependencies", "业务依赖"],
            ["conditions", "基础约束"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-current={view.section === id ? "page" : undefined}
            onClick={() => onView({ section: id })}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      {view.section === "conditions" ? (
        <dl className={styles.readValues}>
          {planningConditionFields.map(([k, label]) => (
            <div key={k}>
              <dt>{t(label)}</dt>
              <dd>{p.conditions[k] || t("未填写")}</dd>
            </div>
          ))}
        </dl>
      ) : view.section === "dependencies" ? (
        <table className={styles.table}>
          <thead>
            <tr>
              {[
                "上游系统(被依赖方)",
                "下游系统（依赖方）",
                "依赖强度",
                "依赖说明",
              ].map((x) => (
                <th key={x}>{t(x)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.dependencies.map((d) => (
              <tr key={d.id}>
                <td>{d.upstream}</td>
                <td>{d.downstream}</td>
                <td>{t(d.strength === "strong" ? "强依赖" : "弱依赖")}</td>
                <td>{d.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className={styles.actions}>
            {(
              [
                ["vms", "按虚拟机"],
                ["systems", "按业务系统"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                aria-pressed={view.assetMode === id}
                onClick={() =>
                  onView({
                    assetMode: id,
                    query: "",
                    systemFocus: undefined,
                    assetPage: { ...view.assetPage, page: 1 },
                  })
                }
              >
                {t(label)}
              </Button>
            ))}
          </div>
          {view.assetMode === "systems" ? (
            <PlanningSystems
              assets={p.assets}
              view={view}
              onView={onView}
              locked={false}
              readOnly
            />
          ) : (
            <PlanningAssets
              assets={p.assets}
              view={view}
              onView={onView}
              locked={false}
              attributes
              readOnly
            />
          )}
        </>
      )}
    </>
  );
}
