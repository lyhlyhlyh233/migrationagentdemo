import { PlanningSummary } from "./PlanningSummary";
import { useState } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import { migrationScope } from "@/domain/assessment";
import {
  planningIsStale,
  planningSummary,
  planningWarnings,
  type PlanningAdjustment,
  type PlanningInputPatch,
} from "@/domain/planning";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button, FileField } from "@/shared/ui/primitives";
import { PlanningInputs } from "./PlanningInputs";
import { PlanningBatches } from "./PlanningBatches";
import { PlanningPreview } from "./PlanningPreview";
import { PlanningResources, PlanningTimeline } from "./PlanningResources";
import type { PlanningView } from "./state";
import styles from "./Planning.module.css";
export interface PlanningWorkspaceProps {
  snapshot: ProjectSnapshot;
  view: PlanningView;
  onView: (patch: Partial<PlanningView>) => void;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
  onDownload: (id: string) => void;
  onUpload: (purpose: FilePurpose, file: File) => Promise<boolean>;
  conversationId: string | null;
  compact?: boolean;
  onManage?: () => void;
}
export function PlanningWorkspace({
  snapshot: s,
  view,
  onView,
  onCommand,
  onDownload,
  onUpload,
  conversationId,
  compact = false,
  onManage,
}: PlanningWorkspaceProps) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const p = s.planning;
  if (!p || !s.enteredStages.includes("planning"))
    return (
      <section className={styles.empty}>
        <h2>{t("迁移规划")}</h2>
        <p>{t("完成调研评估并人工确认交接后，可以补充规划资料和生成初稿。")}</p>
        <Button
          onClick={() =>
            void onCommand({ type: "stage.review", target: "planning" })
          }
        >
          {t("查看规划交接条件")}
        </Button>
      </section>
    );
  const summary = planningSummary(p);
  const stale = planningIsStale(s);
  const generated = p.batches.length > 0;
  const unsaved = !!(
    view.conditionsDraft ||
    view.capacityDraft ||
    view.dependenciesDraft ||
    view.attributesDraft
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
    if (ok && command.type === "planning.apply")
      onView({ selected: [], batchSelected: [] });
    return ok;
  }
  async function save(patch: PlanningInputPatch) {
    const ok = await execute({
      type: "planning.save",
      expectedRevision: view.draftRevision ?? p!.revision,
      patch,
    });
    if (ok)
      onView({
        ...(patch.conditions ? { conditionsDraft: undefined } : {}),
        ...(patch.capacity ? { capacityDraft: undefined } : {}),
        ...(patch.dependencies ? { dependenciesDraft: undefined } : {}),
        ...(patch.attributes
          ? { attributesDraft: undefined, attributeSelected: [] }
          : {}),
        draftRevision: p!.revision + 1,
      });
  }
  async function preview(change: PlanningAdjustment) {
    await execute({
      type: "planning.preview",
      expectedRevision: p!.revision,
      change,
    });
  }
  if (compact)
    return (
      <PlanningSummary
        snapshot={s}
        view={view}
        onView={onView}
        onSave={save}
        onCommand={execute}
        onUpload={onUpload}
        onDownload={onDownload}
        onManage={onManage}
        locked={locked}
        unsaved={unsaved}
        error={error}
        conversationId={conversationId}
      />
    );
  return (
    <section
      className={styles.root}
      tabIndex={-1}
      data-compact={compact || undefined}
      aria-label={t("迁移规划工作台")}
    >
      <header className={styles.header}>
        <div>
          <h2>{t(compact ? "规划设计" : "迁移规划")}</h2>
          <span>{t("模拟估算")}</span>
          <span data-tone={stale ? "warning" : undefined}>
            {t(
              s.batchConfirmation === "confirmed"
                ? "已交接 · 只读"
                : stale
                  ? "待更新"
                  : generated
                    ? "当前初稿"
                    : "准备规划资料",
            )}
          </span>
        </div>
        <div className={styles.actions}>
          <Button
            disabled={locked || unsaved}
            onClick={() => setUploadOpen(!uploadOpen)}
          >
            {t("导入资料 / 调整")}
          </Button>
          <Button
            onClick={() =>
              onDownload(generated ? "batch-plan" : "planning-template")
            }
          >
            {t(generated ? "导出规划" : "下载模板")}
          </Button>
        </div>
      </header>
      <div className={styles.summary}>
        <span>
          {t("评估总量")} <strong>{p.assets.length}</strong>
        </span>
        <span>
          {t("可纳入")}{" "}
          <strong data-tone="success">
            {generated ? summary.included : migrationScope(s).length}
          </strong>
        </span>
        <span>
          {t("暂时排除")}{" "}
          <strong data-tone="warning">
            {generated
              ? summary.excluded
              : p.assets.length - migrationScope(s).length}
          </strong>
        </span>
        {generated && (
          <>
            <span>
              {p.batches.length} {t("个批次")}
            </span>
            <span>
              {t("预计")} {summary.days} {t("天")}
            </span>
          </>
        )}
      </div>
      <nav className={styles.tabs} aria-label={t("规划视图")}>
        {(
          [
            ["inputs", "规划资料"],
            ["batches", "批次计划"],
            ["resources", "资源需求"],
            ["timeline", "迁移时间线"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-current={view.tab === id ? "page" : undefined}
            onClick={() => onView({ tab: id })}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      <div className={styles.scroll}>
        {uploadOpen && (
          <div className={styles.editor}>
            <FileField
              label={t("上传规划资料或调整表格")}
              filename={s.planningWorkbook}
              disabled={locked || unsaved}
              onFile={(file) => {
                setBusy(true);
                setError(false);
                void onUpload("planning", file).then((ok) => {
                  setBusy(false);
                  setError(!ok);
                  if (ok) setUploadOpen(false);
                });
              }}
            />
            <p className={styles.note}>
              {t("展示示例解析结果，尚未读取实际表格内容。已有填写会保留。")}
            </p>
          </div>
        )}
        {p.preview && (
          <PlanningPreview
            key={p.preview.id}
            preview={p.preview}
            canApply={
              p.preview.conversationId === conversationId &&
              s.batchConfirmation !== "confirmed"
            }
            onCommand={execute}
          />
        )}
        {unsaved && (
          <div className={styles.unsaved}>
            <span>{t("有未保存的规划资料")}</span>
            <Button
              onClick={() =>
                onView({
                  conditionsDraft: undefined,
                  capacityDraft: undefined,
                  dependenciesDraft: undefined,
                  attributesDraft: undefined,
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
        {view.tab === "inputs" ? (
          <PlanningInputs
            planning={p}
            view={view}
            onView={onView}
            onSave={save}
            locked={locked}
          />
        ) : view.tab === "resources" ? (
          <PlanningResources
            planning={p}
            view={view}
            onView={onView}
            onSave={save}
            locked={locked}
          />
        ) : !generated ? (
          <div className={styles.empty}>
            <p>{t("生成规划后查看批次与时间线")}</p>
            <p>{t("业务属性可以稍后补充，未知依赖会持续标记。")}</p>
          </div>
        ) : view.tab === "batches" ? (
          <PlanningBatches
            planning={p}
            view={view}
            onView={onView}
            locked={locked || unsaved}
            onPreview={preview}
            confirmed={s.batchConfirmation === "confirmed"}
          />
        ) : (
          <PlanningTimeline
            planning={p}
            onBatch={(id) =>
              onView({
                tab: "batches",
                expandedBatch: id,
                query: "",
                grade: "",
                assetPage: { ...view.assetPage, page: 1 },
              })
            }
          />
        )}
        {generated && (
          <details className={styles.warnings}>
            <summary>
              {t("规划依据与待核对事项")} · {planningWarnings(p).length}
            </summary>
            <p>
              {t(
                "示例先试点、再核心业务、再规模迁移。强依赖核对共同割接；实际排程仍需专业评估。",
              )}
            </p>
            <ul>
              {planningWarnings(p).map((w) => (
                <li key={w}>{t(w)}</li>
              ))}
            </ul>
            <p>{t("停机时长为各批次估算合计，不代表所有业务同时停机。")}</p>
          </details>
        )}
      </div>
      {s.batchConfirmation !== "confirmed" && (
        <footer className={styles.footer}>
          <span>{t("业务资料可稍后补充")}</span>
          <Button
            primary
            disabled={locked || unsaved || (generated && !stale)}
            onClick={() => {
              void execute({ type: "planning.useSample" }).then((ok) => {
                if (ok)
                  onView({ tab: "batches", selected: [], batchSelected: [] });
              });
            }}
          >
            {t(
              s.planningStatus === "generating"
                ? "正在生成"
                : generated && !stale
                  ? "初稿已生成"
                  : stale
                    ? "重新生成模拟初稿"
                    : "生成规划初稿",
            )}
          </Button>
        </footer>
      )}
    </section>
  );
}
