import { useId, useState } from "react";
import type { MigrationMethod, RiskItem, RiskStrategy } from "@/domain/models";
import { vmCount } from "./presentation";
import { hasRiskDecision } from "@/domain/assessment";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { migrationMethodLabels, riskStrategyLabels } from "@/shared/i18n/risks";
import { Button } from "@/shared/ui/primitives";
import dockStyles from "./RiskStrategyDock.module.css";
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
  locked = false,
  feedback,
  onSubmit,
  onCancel,
  onlyUndecided = false,
}: {
  risks: RiskItem[];
  saving: boolean;
  locked?: boolean;
  feedback?: string;
  onSubmit: (command: ProjectCommand) => void;
  onCancel: () => void;
  onlyUndecided?: boolean;
}) {
  const t = useTranslation();
  const uid = useId();
  const [overwrite, setOverwrite] = useState(false);
  const preserveExisting = onlyUndecided && !overwrite;
  const targets = risks.filter((r) => !preserveExisting || !hasRiskDecision(r));
  const single = targets.length === 1 ? targets[0] : undefined;
  const [choice, setChoice] = useState<RiskStrategy | "recommended">(
    (!onlyUndecided && single?.decision?.strategy) || "recommended",
  );
  const [method, setMethod] = useState<MigrationMethod>(
    single?.decision?.method ?? single?.recommendedMethod ?? "agentless",
  );
  const [note, setNote] = useState(single?.decision?.note ?? "");
  const canIgnore = targets.every((r) => r.impact === "constraint");
  const options = [
    {
      value: "recommended" as const,
      label: "采用评估建议",
      description: "按每条风险的建议分别处理，保留各自迁移方式。",
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
        if (
          saving ||
          locked ||
          !targets.length ||
          (choice === "ignore" && !canIgnore)
        )
          return;
        onSubmit(
          choice === "recommended"
            ? {
                type: "risk.recommend",
                riskIds: risks.map((r) => r.id),
                onlyUndecided: preserveExisting,
              }
            : {
                type: "risk.decide",
                riskIds: risks.map((r) => r.id),
                onlyUndecided: preserveExisting,
                decision: {
                  strategy: choice,
                  method: choice === "exclude" ? "manual" : method,
                  note,
                },
              },
        );
      }}
    >
      <div className={dockStyles.body}>
        <header>
          <span>
            {onlyUndecided
              ? t(
                  "本次处理 {0} 条，保留 {1} 条，覆盖 {2} 条已有策略。",
                  targets.length,
                  risks.length - targets.length,
                  targets.filter(hasRiskDecision).length,
                )
              : t(
                  "{0} 条风险 · {1} 台虚拟机",
                  targets.length,
                  vmCount(targets),
                )}
          </span>
        </header>
        {!!targets.filter((r) => r.closed).length && (
          <p className={styles.note}>
            {t(
              "将重置 {0} 条已验证记录的验证状态，需按新策略重新核验。",
              targets.filter((r) => r.closed).length,
            )}
          </p>
        )}
        {!targets.length && (
          <p className={styles.note}>
            {t("没有待处理项。已有策略默认保留，可勾选覆盖或取消操作。")}
          </p>
        )}
        <fieldset
          className={styles.options}
          disabled={saving || locked || !targets.length}
          aria-label={t("处置方式")}
        >
          {options.map((option) => (
            <label
              key={option.value}
              className={styles.option}
              title={t(option.description)}
              data-selected={choice === option.value}
              data-disabled={option.value === "ignore" && !canIgnore}
            >
              <input
                type="radio"
                name={`${uid}-strategy`}
                value={option.value}
                checked={choice === option.value}
                disabled={option.value === "ignore" && !canIgnore}
                aria-describedby={
                  option.value === "ignore" && !canIgnore
                    ? `${uid}-ignore-reason`
                    : `${uid}-strategy-hint`
                }
                onChange={() => choose(option.value)}
              />
              <span>
                <strong>
                  {t(option.label)}
                  {option.value === "recommended" && <em>{t("推荐")}</em>}
                </strong>
              </span>
            </label>
          ))}
        </fieldset>
        <details className={styles.guidance}>
          <summary>{t("查看策略说明")}</summary>
          <p className={styles.note} id={`${uid}-strategy-hint`}>
            {t(options.find((option) => option.value === choice)!.description)}
          </p>
          {!canIgnore && (
            <p className={styles.note} id={`${uid}-ignore-reason`}>
              {t("所选风险含阻塞或整改项，不能直接忽略。")}
            </p>
          )}
        </details>
        {choice !== "recommended" && (
          <div className={styles.details}>
            {choice !== "exclude" && (
              <fieldset className={styles.methods} disabled={saving || locked}>
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
              disabled={saving || locked}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("说明采用的方案、约束或验证要求（4 至 500 字）")}
              required
              minLength={4}
              maxLength={500}
            />
          </div>
        )}
        {locked && (
          <p className={styles.note}>
            {t("实施准备已开始，策略已锁定；仍可补充验证记录。")}
          </p>
        )}
        {feedback && (
          <p role="alert" className={styles.error}>
            {feedback}
          </p>
        )}
      </div>
      <footer className={dockStyles.actions}>
        {onlyUndecided && (
          <label className={dockStyles.overwrite}>
            <input
              type="checkbox"
              checked={overwrite}
              disabled={saving || locked}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            {t("覆盖已有策略")}
          </label>
        )}
        <Button onClick={onCancel} disabled={saving}>
          {t("取消")}
        </Button>
        <Button
          primary
          type="submit"
          disabled={
            saving ||
            locked ||
            !targets.length ||
            (choice !== "recommended" && note.trim().length < 4) ||
            (choice === "ignore" && !canIgnore)
          }
        >
          {t(saving ? "保存中…" : "应用策略")}
        </Button>
      </footer>
    </form>
  );
}
