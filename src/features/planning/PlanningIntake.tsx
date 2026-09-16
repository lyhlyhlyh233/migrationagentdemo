import { useRef, useState } from "react";
import type { PlanningInputPatch } from "@/domain/planning";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { PlanningInputs } from "./PlanningInputs";
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
  onConfirmation,
}: Omit<PlanningWorkspaceProps, "compact" | "onManage"> & {
  onConfirmation: (id: string) => void;
}) {
  const t = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
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
      <div className={styles.intakeActions}>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setError(false);
            void onUpload("planning", file).then((ok) => {
              setBusy(false);
              setError(!ok);
            });
          }}
        />
        <Button
          disabled={locked || unsaved}
          onClick={() => fileInput.current?.click()}
        >
          <Icon name="attach" size={15} />
          {t("导入规划资料")}
        </Button>
        <button
          type="button"
          className={`${styles.textAction} ${styles.downloadLink}`}
          onClick={() => onDownload("planning-template")}
        >
          {t("下载模板")}
        </button>
      </div>
      <p className={styles.note}>
        {s.planningWorkbook || t("尚未导入资料")} ·{" "}
        {t("补充业务属性与依赖，也可填写基础约束；上传仅展示样例解析。")}
      </p>
      {p.preview ? (
        <Button
          disabled={p.preview.conversationId !== conversationId}
          onClick={() => onConfirmation(p.preview!.id)}
        >
          {t("查看导入预览")}
          <Icon name="right" size={15} />
        </Button>
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
            <span>{t("基础约束")}</span>
            <small>
              {p.conditions.fullBandwidth} / {p.conditions.incrementalBandwidth}{" "}
              Gbps · {t("并发 {0}", p.conditions.concurrency)}
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
          <Icon name="right" size={15} />
        </Button>
        <button
          type="button"
          className={styles.textAction}
          disabled={locked || unsaved}
          onClick={() => void execute({ type: "planning.sampleInputs" })}
        >
          {t("使用样例数据")}
        </button>
      </div>
    </section>
  );
}
