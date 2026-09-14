import { useId, useState } from "react";
import type { AssessmentPlan, ProjectSnapshot } from "@/domain/models";
import {
  assessmentCounts,
  canChangeAssessmentDecision,
  migrationScope,
} from "@/domain/assessment";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button, ResultFrame } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/Select";
import styles from "./AssessmentDecision.module.css";
export function AssessmentDecision({
  snapshot: s,
  onCommand,
  onRisks,
  onAsk,
}: {
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => void;
  onRisks: () => void;
  onAsk?: (text: string) => void;
}) {
  const t = useTranslation();
  const id = useId();
  const [mode, setMode] = useState<AssessmentPlan["mode"]>(
    s.assessmentPlan?.mode ?? "hybrid",
  );
  const [note, setNote] = useState(s.assessmentPlan?.note ?? "");
  const n = assessmentCounts(s);
  const included = migrationScope(s).length;
  const editable = canChangeAssessmentDecision(s);
  return (
    <div className={styles.root}>
      <ResultFrame
        title={t("迁移方案与范围")}
        actions={
          <>
            <Button onClick={onRisks}>
              {t("查看风险与策略")} · {n.undecided}
            </Button>
            {!s.enteredStages.includes("planning") && (
              <Button
                primary
                onClick={() =>
                  onCommand({ type: "stage.review", target: "planning" })
                }
              >
                {t("暂不处理，继续规划")}
              </Button>
            )}
          </>
        }
      >
        <p>
          {t(
            "可纳入 {0} 台，暂时排除 {1} 台。无需逐项确认，受阻对象不会进入实施。",
            included,
            s.scopeRows.length - included,
          )}
        </p>
        <form
          className={styles.plan}
          onSubmit={(e) => {
            e.preventDefault();
            onCommand({
              type: "assessment.choosePlan",
              plan: { mode, note: note.trim() },
            });
          }}
        >
          <label htmlFor={id}>{t("总体方案（可选）")}</label>
          <div className={styles.selection}>
            <Select
              id={id}
              aria-label={t("总体迁移方案")}
              value={mode}
              disabled={!editable}
              onValueChange={(value) =>
                setMode(value as AssessmentPlan["mode"])
              }
            >
              <option value="hybrid">{t("混合迁移 · 建议")}</option>
              <option value="agentless">{t("免代理优先")}</option>
              <option value="custom">{t("自定义方案")}</option>
            </Select>
            <Button
              type="submit"
              disabled={
                !editable || (mode === "custom" && note.trim().length < 4)
              }
            >
              {t("采用方案")}
            </Button>
          </div>
          <p className={styles.hint}>
            {t(
              mode === "hybrid"
                ? "可迁对象优先免代理；磁盘或应用限制单独验证有代理或重建方案。"
                : mode === "agentless"
                  ? "优先统一免代理方式，需调整的对象先整改验证；未满足条件的对象暂不迁移。"
                  : "写明迁移方式、例外对象与验证要求，具体对象仍以风险策略为准。",
            )}
          </p>
          {mode === "custom" && (
            <textarea
              aria-label={t("自定义迁移方案")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(
                "例如：普通业务免代理，数据库专项验证，虚拟设备另行重建。",
              )}
              minLength={4}
              maxLength={500}
              required
              disabled={!editable}
            />
          )}
          {s.assessmentPlan && (
            <small role="status">
              {t(
                "已采用：{0}",
                t(
                  s.assessmentPlan.mode === "hybrid"
                    ? "混合迁移"
                    : s.assessmentPlan.mode === "agentless"
                      ? "免代理优先"
                      : "自定义方案",
                ),
              )}
            </small>
          )}
        </form>
        {onAsk && (
          <div className={styles.questions}>
            {[
              "解读评估报告并给出建议",
              "为什么 RDM 要考虑有代理迁移？",
              "应用迁移有哪些限制？",
            ].map((q) => (
              <button type="button" key={q} onClick={() => onAsk(t(q))}>
                {t(q)}
              </button>
            ))}
          </div>
        )}
      </ResultFrame>
    </div>
  );
}
