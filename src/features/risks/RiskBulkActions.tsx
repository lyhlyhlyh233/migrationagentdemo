import { useState } from "react";
import type { ProjectSnapshot, RiskItem } from "@/domain/models";
import {
  previewRiskDecisions,
  riskDecisionUpdates,
  type BulkRiskAction,
} from "@/domain/risk-decisions";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { categoryGroups, ruleGroups, vmCount } from "./presentation";
import styles from "./RiskPanel.module.css";

export function RiskBulkToolbar({
  selected,
  available,
  saving,
  editable,
  onClear,
  onAction,
}: {
  selected: RiskItem[];
  available: RiskItem[];
  saving: boolean;
  editable: boolean;
  onClear: () => void;
  onAction: (action: BulkRiskAction | "custom") => void;
}) {
  const t = useTranslation();
  const disabled =
    !editable || saving || !(selected.length || available.length);
  return (
    <div
      className={styles.bulkBar}
      role="region"
      aria-label={t("批量风险操作")}
    >
      <div className={styles.selectionSummary} aria-live="polite">
        <span>
          {selected.length
            ? t(
                "已选 {0} 个大类 · {1} 个小类 · {2} 条风险 · {3} 台虚拟机",
                categoryGroups(selected).length,
                ruleGroups(selected).length,
                selected.length,
                vmCount(selected),
              )
            : t(
                "未选择范围：快捷操作将处理当前筛选结果全部 {0} 条评估风险（含所有页）。",
                available.length,
              )}
        </span>
        {!!selected.length && (
          <button
            className={styles.textAction}
            disabled={saving}
            onClick={onClear}
          >
            {t("清空选择")}
          </button>
        )}
      </div>
      <div className={styles.bulkButtons}>
        <Button
          className={styles.bulkPrimary}
          disabled={disabled || !selected.length}
          onClick={() => onAction("custom")}
        >
          {t("批量设置策略")}
        </Button>
        <Button disabled={disabled} onClick={() => onAction("recommended")}>
          {t("采用评估建议")}
        </Button>
        <Button
          disabled={disabled}
          onClick={() => onAction("ignore-or-exclude")}
        >
          {t(selected.length ? "忽略所选" : "全部忽略")}
        </Button>
        <Button disabled={disabled} onClick={() => onAction("exclude")}>
          {t(selected.length ? "所选不迁" : "全部不迁")}
        </Button>
      </div>
    </div>
  );
}

export function RiskBulkConfirmation({
  snapshot,
  risks,
  action,
  saving,
  onSubmit,
  onCancel,
}: {
  snapshot: ProjectSnapshot;
  risks: RiskItem[];
  action: BulkRiskAction;
  saving: boolean;
  onSubmit: (command: ProjectCommand) => void;
  onCancel: () => void;
}) {
  const t = useTranslation();
  const [overwrite, setOverwrite] = useState(false);
  const preview = previewRiskDecisions(snapshot, risks, action, !overwrite);
  return (
    <form
      className={styles.bulkConfirmation}
      onSubmit={(event) => {
        event.preventDefault();
        if (saving || !preview.total) return;
        const common = {
          riskIds: risks.map((r) => r.id),
          onlyUndecided: !overwrite,
        };
        onSubmit(
          action === "recommended"
            ? { type: "risk.recommend", ...common }
            : action === "ignore-or-exclude"
              ? { type: "risk.ignoreOrExclude", ...common }
              : {
                  type: "risk.decide",
                  ...common,
                  decision: riskDecisionUpdates(risks, "exclude", false)[0]
                    .decision,
                },
        );
      }}
    >
      <h3>
        {t(
          action === "recommended"
            ? "确认采用评估建议"
            : action === "ignore-or-exclude"
              ? "确认忽略与不迁策略"
              : "确认本次不迁",
        )}
      </h3>
      <p>
        {t("所选范围：{0} 条风险 · {1} 台虚拟机", risks.length, vmCount(risks))}
      </p>
      <label className={styles.overwrite}>
        <input
          type="checkbox"
          checked={overwrite}
          disabled={saving}
          onChange={(event) => setOverwrite(event.target.checked)}
        />
        {t("覆盖已有策略")}
      </label>
      <p aria-live="polite">
        {t(
          "本次处理 {0} 条，保留 {1} 条，覆盖 {2} 条已有策略。",
          preview.total,
          preview.preserved,
          preview.overwritten,
        )}
      </p>
      {action === "ignore-or-exclude" && (
        <p>
          {t(
            "接受约束（忽略）{0} 条；需整改或不支持的 {1} 条设为本次不迁。",
            preview.ignored,
            preview.excluded,
          )}
        </p>
      )}
      <p>{t("处理后项目暂时排除 {0} 台虚拟机。", preview.excludedVms)}</p>
      {!!preview.verified && (
        <p className={styles.warning}>
          {t(
            "将重置 {0} 条已验证记录的验证状态，需按新策略重新核验。",
            preview.verified,
          )}
        </p>
      )}
      {!preview.total && (
        <p className={styles.hint}>
          {t("没有待处理项。已有策略默认保留，可勾选覆盖或取消操作。")}
        </p>
      )}
      <footer className={styles.actions}>
        <Button disabled={saving} onClick={onCancel}>
          {t("取消")}
        </Button>
        <Button
          type="submit"
          className={styles.bulkPrimary}
          disabled={saving || !preview.total}
        >
          {t(saving ? "保存中…" : "确认处理 {0} 项", preview.total)}
        </Button>
      </footer>
    </form>
  );
}
