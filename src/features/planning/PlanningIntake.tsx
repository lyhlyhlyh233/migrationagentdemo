import { useState } from "react";
import type { PlanningInputPatch } from "@/domain/planning";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button, FileField } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { PlanningInputs } from "./PlanningInputs";
import { PlanningPreview } from "./PlanningPreview";
import type { PlanningWorkspaceProps } from "./PlanningWorkspace";
import styles from "./Planning.module.css";

/** Conversation intake shares the workbench draft and existing service commands. */
export function PlanningIntake({
  snapshot: s,
  view,
  onView,
  onCommand,
  onUpload,
  onDownload,
  conversationId,
}: Omit<PlanningWorkspaceProps, "compact" | "onManage">) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const p = s.planning;
  if (!p) return null;
  const unsaved = !!(
    view.conditionsDraft ||
    view.attributesDraft ||
    view.dependenciesDraft ||
    view.capacityDraft
  );
  const locked =
    busy ||
    s.planningStatus === "generating" ||
    s.batchConfirmation === "confirmed" ||
    !!p.preview;
  async function execute(command: ProjectCommand) {
    setBusy(true);
    setError(false);
    const ok = await onCommand(command);
    setBusy(false);
    setError(!ok);
    return ok;
  }
  async function save(patch: PlanningInputPatch) {
    if (
      await execute({
        type: "planning.save",
        patch,
        expectedRevision: view.draftRevision ?? p!.revision,
      })
    ) {
      onView({
        conditionsDraft: undefined,
        draftRevision:
          view.attributesDraft || view.dependenciesDraft || view.capacityDraft
            ? p!.revision + 1
            : undefined,
        intakeConditionsOpen: false,
      });
    }
  }
  return (
    <section
      className={`${styles.root} ${styles.intake}`}
      aria-label={t("规划资料补充")}
    >
      <FileField
        label={t("导入规划资料")}
        filename={s.planningWorkbook}
        disabled={locked || unsaved}
        labelAction={
          <Button onClick={() => onDownload("planning-template")}>
            <Icon name="download" size={14} />
            {t("下载规划模板")}
          </Button>
        }
        onFile={(file) => {
          setBusy(true);
          setError(false);
          void onUpload("planning", file).then((ok) => {
            setBusy(false);
            setError(!ok);
          });
        }}
      />
      <p className={styles.note}>
        {t(
          "主要补充业务系统、业务等级、集群类型与角色，也可一并填写业务依赖、带宽和迁移约束。业务资料可选。",
        )}
      </p>
      <p className={styles.note}>
        {t("上传后展示示例解析预览，尚未读取实际表格内容；确认后才应用。")}
      </p>
      {p.preview ? (
        <PlanningPreview
          key={p.preview.id}
          preview={p.preview}
          canApply={
            p.preview.conversationId === conversationId &&
            s.batchConfirmation !== "confirmed"
          }
          onCommand={execute}
        />
      ) : (
        <details
          className={styles.intakeConditions}
          open={!!view.intakeConditionsOpen}
          onToggle={(e) => {
            if (e.currentTarget.open !== !!view.intakeConditionsOpen)
              onView({ intakeConditionsOpen: e.currentTarget.open });
          }}
        >
          <summary>
            <span>{t("带宽与基础约束")}</span>
            <small>
              {t(
                p.conditionsSource === "sample"
                  ? "已预填示例值"
                  : "已保存项目条件",
              )}
            </small>
          </summary>
          <PlanningInputs
            planning={p}
            view={{ ...view, section: "conditions" }}
            onView={onView}
            onSave={save}
            locked={locked}
            conditionsOnly
          />
        </details>
      )}
      {unsaved && (
        <div className={styles.unsaved}>
          <span>
            {t("有未保存的规划资料，请先保存或放弃修改再导入、生成。")}
          </span>
          <Button
            disabled={busy}
            onClick={() =>
              onView({
                conditionsDraft: undefined,
                attributesDraft: undefined,
                dependenciesDraft: undefined,
                capacityDraft: undefined,
                draftRevision: undefined,
              })
            }
          >
            {t("放弃未保存修改")}
          </Button>
        </div>
      )}
      {error && (
        <div role="alert" className={styles.error}>
          <p>
            {t("操作未完成，输入已保留。请核对最新数据后重试，或取消预览。")}
          </p>
          {view.draftRevision !== undefined &&
            view.draftRevision !== p.revision && (
              <Button onClick={() => onView({ draftRevision: p.revision })}>
                {t("已核对最新数据，保留输入重试")}
              </Button>
            )}
        </div>
      )}
      <div className={styles.resultActions}>
        <Button
          primary
          disabled={locked || unsaved}
          onClick={() => void execute({ type: "planning.useSample" })}
        >
          {t(s.planningStatus === "generating" ? "正在生成" : "生成规划初稿")}
        </Button>
      </div>
    </section>
  );
}
