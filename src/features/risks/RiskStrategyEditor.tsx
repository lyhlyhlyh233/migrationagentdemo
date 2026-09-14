import { useId, useState } from "react";
import type { MigrationMethod, RiskItem, RiskStrategy } from "@/domain/models";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { migrationMethodLabels, riskStrategyLabels } from "@/shared/i18n/risks";
import { Button } from "@/shared/ui/primitives";
import styles from "./RiskStrategyEditor.module.css";

const strategyHints: Record<RiskStrategy, string> = {
  ignore: "保留迁移约束，继续纳入可迁范围。",
  remediate: "先记录整改方案，验证通过后再纳入迁移。",
  exclude: "从本次工具迁移范围排除关联虚拟机。",
  custom: "补充自己的迁移方案、例外和验证要求。",
};

export function RiskStrategyEditor({
  risks,
  saving,
  onSubmit,
  onCancel,
}: {
  risks: RiskItem[];
  saving: boolean;
  onSubmit: (command: ProjectCommand) => void;
  onCancel: () => void;
}) {
  const t = useTranslation();
  const uid = useId();
  const single = risks.length === 1 ? risks[0] : undefined;
  const [choice, setChoice] = useState<RiskStrategy | "recommended">(
    single?.decision?.strategy ?? "recommended",
  );
  const [method, setMethod] = useState<MigrationMethod>(
    single?.decision?.method ?? single?.recommendedMethod ?? "agentless",
  );
  const [note, setNote] = useState(single?.decision?.note ?? "");
  const canIgnore = risks.every((r) => r.impact === "constraint");
  const vmNames = [...new Set(risks.map((r) => r.vmName))];
  const options = [
    {
      value: "recommended" as const,
      label: "采用评估建议",
      description:
        single?.recommendation ??
        "按每条风险的建议分别处理，保留各自迁移方式。",
    },
    ...(["ignore", "remediate", "exclude", "custom"] as const).map((value) => ({
      value,
      label: riskStrategyLabels[value],
      description:
        value === "ignore" && !canIgnore
          ? "所选风险含阻塞或整改项，不能直接忽略。"
          : strategyHints[value],
    })),
  ];
  function choose(value: typeof choice) {
    setChoice(value);
    if (value !== "custom" && method === "manual") setMethod("agentless");
    if (!note && value === single?.recommendedStrategy)
      setNote(single.recommendation ?? "");
  }
  return (
    <form
      className={styles.root}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          choice === "recommended"
            ? {
                type: "risk.recommend",
                riskIds: risks.map((r) => r.id),
              }
            : {
                type: "risk.decide",
                riskIds: risks.map((r) => r.id),
                decision: {
                  strategy: choice,
                  method: choice === "exclude" ? "manual" : method,
                  note,
                },
              },
        );
      }}
    >
      <header>
        <strong>{t("如何处理所选风险？")}</strong>
        <span>
          {t("{0} 条风险 · {1} 台虚拟机", risks.length, vmNames.length)}
        </span>
        <p>
          {single
            ? t(single.description)
            : vmNames.slice(0, 3).join("、") +
              (vmNames.length > 3 ? t("等 {0} 台", vmNames.length) : "")}
        </p>
      </header>
      <fieldset
        className={styles.options}
        disabled={saving}
        aria-label={t("处置方式")}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={styles.option}
            data-selected={choice === option.value}
            data-disabled={option.value === "ignore" && !canIgnore}
          >
            <input
              type="radio"
              name={`${uid}-strategy`}
              value={option.value}
              checked={choice === option.value}
              disabled={option.value === "ignore" && !canIgnore}
              onChange={() => choose(option.value)}
            />
            <span>
              <strong>
                {t(option.label)}
                {option.value === "recommended" && <em>{t("推荐")}</em>}
              </strong>
              <small>{t(option.description)}</small>
            </span>
          </label>
        ))}
      </fieldset>
      {choice !== "recommended" && (
        <div className={styles.details}>
          {choice !== "exclude" && (
            <fieldset className={styles.methods} disabled={saving}>
              <legend>{t("迁移方式")}</legend>
              {(["agentless", "agent", "manual"] as const).map((value) => (
                <label key={value} data-selected={method === value}>
                  <input
                    type="radio"
                    name={`${uid}-method`}
                    value={value}
                    checked={method === value}
                    disabled={value === "manual" && choice !== "custom"}
                    onChange={() => setMethod(value)}
                  />
                  {t(migrationMethodLabels[value])}
                </label>
              ))}
            </fieldset>
          )}
          <label htmlFor={`${uid}-note`}>{t("策略说明")}</label>
          <textarea
            id={`${uid}-note`}
            value={note}
            disabled={saving}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("说明采用的方案、约束或验证要求（4 至 500 字）")}
            required
            minLength={4}
            maxLength={500}
          />
        </div>
      )}
      <footer>
        <Button onClick={onCancel} disabled={saving}>
          {t("暂不处理")}
        </Button>
        <Button
          primary
          type="submit"
          disabled={
            saving ||
            (choice !== "recommended" && note.trim().length < 4) ||
            (choice === "ignore" && !canIgnore)
          }
        >
          {t(saving ? "保存中…" : "确认策略")}
        </Button>
      </footer>
      <p className={styles.note}>
        {t("确认后记录到对话；选择整改不代表已完成验证。")}
      </p>
    </form>
  );
}
