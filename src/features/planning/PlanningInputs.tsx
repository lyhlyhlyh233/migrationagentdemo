import { planningConditionFields } from "@/shared/i18n/planning";
import type {
  PlanningState,
  PlanningInputPatch,
  PlanningConditions,
} from "@/domain/planning";
import { useTranslation } from "@/shared/i18n";
import { Button, Field } from "@/shared/ui/primitives";
import type { PlanningView } from "@/stores/planningState";
import styles from "./Planning.module.css";

/** The conversation exposes only the eight basic planning constraints. */
export function PlanningInputs({
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
  const conditions = view.conditionsDraft ?? p.conditions;
  function editConditions(key: keyof PlanningConditions, value: string) {
    onView({
      conditionsDraft: {
        ...conditions,
        [key]: typeof p.conditions[key] === "number" ? Number(value) : value,
      },
      draftRevision: view.draftRevision ?? p.revision,
    });
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ conditions });
      }}
    >
      <div className={styles.compactConditions}>
        {planningConditionFields.map(([key, label]) => (
          <Field
            key={key}
            label={t(label)}
            type={
              key === "startDate"
                ? "date"
                : typeof conditions[key] === "number"
                  ? "number"
                  : "text"
            }
            required={key !== "freeze"}
            min={
              key === "concurrency"
                ? 1
                : typeof conditions[key] === "number"
                  ? 0.1
                  : undefined
            }
            step={key === "concurrency" ? 1 : "any"}
            disabled={locked}
            value={conditions[key]}
            placeholder={
              key === "freeze" ? t("例如：2026-10-01 至 2026-10-07") : undefined
            }
            onChange={(e) => editConditions(key, e.target.value)}
          />
        ))}
      </div>
      <div className={styles.actions}>
        <Button
          primary
          type="submit"
          disabled={locked || !view.conditionsDraft}
        >
          {t("保存条件")}
        </Button>
      </div>
    </form>
  );
}
