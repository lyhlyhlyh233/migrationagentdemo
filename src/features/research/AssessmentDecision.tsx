import { useId, useRef, useState } from "react";
import type { AssessmentPlan, ProjectSnapshot } from "@/domain/models";
import { canChangeAssessmentDecision } from "@/domain/assessment";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/Select";
import styles from "./AssessmentDecision.module.css";

const names = {
  hybrid: "混合迁移",
  agentless: "免代理优先",
  custom: "自定义方案",
};
const hints = {
  hybrid: "可迁对象优先免代理；受限对象单独验证有代理或重建方案。",
  agentless: "优先免代理，未满足条件的对象先整改验证。",
  custom: "具体对象的迁移方式与条件仍以风险策略为准。",
};
export function AssessmentDecision({
  snapshot: s,
  onCommand,
  onRisks,
}: {
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onRisks: () => void;
}) {
  const t = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssessmentPlan["mode"]>(
    s.assessmentPlan?.mode ?? "hybrid",
  );
  const [note, setNote] = useState(s.assessmentPlan?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const submitting = useRef(false);
  const editable = canChangeAssessmentDecision(s);
  const current = s.assessmentPlan?.mode ?? "hybrid";
  return (
    <section className={styles.root} aria-label={t("迁移方案与范围")}>
      <div className={styles.summary}>
        <strong>
          {t(
            s.assessmentPlan ? "当前方案：{0}" : "建议方案：{0}",
            t(names[current]),
          )}
        </strong>
        <button
          type="button"
          disabled={saving}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            if (!open) {
              setMode(s.assessmentPlan?.mode ?? "hybrid");
              setNote(s.assessmentPlan?.note ?? "");
              setError(false);
            }
            setOpen(!open);
          }}
        >
          {t(open ? "收起" : editable ? "调整方案" : "查看方案")}
        </button>
        <button type="button" onClick={onRisks}>
          {t("查看风险")}
        </button>
      </div>
      <p className={styles.hint}>{t(hints[current])}</p>
      {open && (
        <form
          id={id}
          className={styles.plan}
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting.current) return;
            submitting.current = true;
            setSaving(true);
            setError(false);
            let ok = false;
            try {
              ok = await onCommand({
                type: "assessment.choosePlan",
                plan: { mode, note: note.trim() },
              });
            } catch {
              ok = false;
            } finally {
              submitting.current = false;
              setSaving(false);
            }
            if (ok) setOpen(false);
            else setError(true);
          }}
        >
          <label htmlFor={`${id}-mode`}>{t("总体方案（可选）")}</label>
          <div className={styles.selection}>
            <Select
              id={`${id}-mode`}
              aria-label={t("总体迁移方案")}
              value={mode}
              disabled={!editable || saving}
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
                !editable ||
                saving ||
                (mode === "custom" && note.trim().length < 4)
              }
            >
              {t(saving ? "保存中…" : "采用方案")}
            </Button>
          </div>
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
              disabled={!editable || saving}
            />
          )}
          <p className={styles.hint}>{t(hints[mode])}</p>
          {error && (
            <p role="alert">{t("保存失败，请稍后重试。输入已保留。")}</p>
          )}
        </form>
      )}
    </section>
  );
}
