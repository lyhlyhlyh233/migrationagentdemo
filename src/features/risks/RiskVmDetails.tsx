import { Fragment, useId, useState, type ReactNode } from "react";
import type { RiskItem } from "@/domain/models";
import { excludedFromTool } from "@/domain/assessment";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { riskImpactLabels } from "@/shared/i18n/risks";
import { Button } from "@/shared/ui/primitives";
import { strategyLabel, vmKey, type RiskLocation } from "./presentation";
import styles from "./RiskPanel.module.css";

export interface RiskInteractions {
  editable: boolean;
  saving: boolean;
  editing: boolean;
  navigationLocked?: boolean;
  inlineEditor?: { key: string; content: ReactNode };
  onEdit: (key: string, risks: RiskItem[], onlyUndecided?: boolean) => void;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onManage?: (location: RiskLocation) => void;
}

/** Shared evidence and per-VM decisions, read-only inside the category drawer. */
export function RiskVmDetails({
  risks,
  showVm = false,
  readOnly = false,
  ...actions
}: {
  risks: RiskItem[];
  showVm?: boolean;
  readOnly?: boolean;
} & RiskInteractions) {
  const t = useTranslation();
  return (
    <div className={styles.findings}>
      {risks.map((risk) => (
        <Fragment key={risk.id}>
          <div className={styles.findingRow}>
            <div>
              <strong>{showVm ? risk.vmName : t(risk.description)}</strong>
              <small>
                R-{risk.id} ·{" "}
                {showVm
                  ? risk.vmId
                  : t(risk.impact ? riskImpactLabels[risk.impact] : "规划风险")}
              </small>
            </div>
            <span>{t(strategyLabel(risk))}</span>
            {readOnly ? (
              <button
                className={styles.textAction}
                disabled={actions.saving || actions.editing}
                onClick={() =>
                  actions.onManage?.({ mode: "vm", vmKey: vmKey(risk) })
                }
              >
                {t("单独处理")}
              </button>
            ) : (
              risk.stage === "research" && (
                <button
                  className={styles.textAction}
                  disabled={
                    !actions.editable || actions.saving || actions.editing
                  }
                  onClick={() => actions.onEdit(`risk:${risk.id}`, [risk])}
                >
                  {t(risk.decision ? "调整策略" : "选择策略")}
                </button>
              )
            )}
          </div>
          {actions.inlineEditor?.key === `risk:${risk.id}` &&
            actions.inlineEditor.content}
          <RiskEvidence
            risk={risk}
            readOnly={readOnly}
            saving={actions.saving || actions.editing}
            onCommand={actions.onCommand}
          />
        </Fragment>
      ))}
    </div>
  );
}

function RiskEvidence({
  risk: r,
  readOnly,
  saving,
  onCommand,
}: {
  risk: RiskItem;
  readOnly: boolean;
  saving: boolean;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
}) {
  const t = useTranslation();
  const id = useId();
  const [verifying, setVerifying] = useState(false);
  const [evidence, setEvidence] = useState("");
  const canVerify =
    !readOnly &&
    !r.closed &&
    !excludedFromTool(r) &&
    (r.stage !== "research" ||
      (r.decision && ["remediate", "custom"].includes(r.decision.strategy)));
  return (
    <details className={styles.evidence}>
      <summary>{t("查看依据与说明")}</summary>
      <dl>
        <div>
          <dt>{t("评估建议")}</dt>
          <dd>{t(r.recommendation ?? r.description)}</dd>
        </div>
        <div>
          <dt>{t("规则依据与原始发现")}</dt>
          <dd>
            {t(r.rule ?? "规划风险")}
            <br />
            {t(r.evidence ?? r.description)}
          </dd>
        </div>
        {r.decision && (
          <div>
            <dt>{t("策略说明")}</dt>
            <dd>{t(r.decision.note)}</dd>
          </div>
        )}
        {r.closed && (
          <div>
            <dt>{t("整改措施与验证依据")}</dt>
            <dd>{r.closureDescription}</dd>
          </div>
        )}
      </dl>
      {canVerify && !verifying && (
        <Button disabled={saving} onClick={() => setVerifying(true)}>
          {t("提交整改验证")}
        </Button>
      )}
      {canVerify && verifying && (
        <form
          className={styles.verification}
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onCommand({
              type: "risk.close",
              riskId: r.id,
              description: evidence,
            });
            if (ok) {
              setVerifying(false);
              setEvidence("");
            }
          }}
        >
          <label htmlFor={id}>{t("整改措施与验证依据")}</label>
          <textarea
            id={id}
            value={evidence}
            disabled={saving}
            onChange={(e) => setEvidence(e.target.value)}
            required
            minLength={4}
            maxLength={500}
          />
          <p className={styles.hint}>
            {t(
              "人工记录验证依据，不代表系统已重新执行兼容性评估。已生成的批次不会自动追加对象。",
            )}
          </p>
          <div className={styles.actions}>
            <Button disabled={saving} onClick={() => setVerifying(false)}>
              {t("取消")}
            </Button>
            <Button
              primary
              type="submit"
              disabled={saving || evidence.trim().length < 4}
            >
              {t("确认验证结果")}
            </Button>
          </div>
        </form>
      )}
    </details>
  );
}
