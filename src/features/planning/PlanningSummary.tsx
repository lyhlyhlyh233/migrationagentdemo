import type { ProjectSnapshot } from "@/domain/models";
import {
  planningSummary,
  planningWarnings,
  planningIsStale,
  type PlanningInputPatch,
} from "@/domain/planning";
import type { FilePurpose, ProjectCommand } from "@/services/contracts";
import { Button, FileField } from "@/shared/ui/primitives";
import { useTranslation } from "@/shared/i18n";
import type { PlanningView } from "./state";
import { PlanningInputs } from "./PlanningInputs";
import { PlanningPreview } from "./PlanningPreview";
import styles from "@/features/migration/Execution.module.css";
export function PlanningSummary({
  snapshot: s,
  view,
  onView,
  onSave,
  onCommand,
  onUpload,
  onDownload,
  onManage,
  locked,
  unsaved,
  error,
  conversationId,
}: {
  snapshot: ProjectSnapshot;
  view: PlanningView;
  onView: (v: Partial<PlanningView>) => void;
  onSave: (p: PlanningInputPatch) => Promise<void>;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onUpload: (p: FilePurpose, f: File) => Promise<boolean>;
  onDownload: (id: string) => void;
  onManage?: () => void;
  locked: boolean;
  unsaved: boolean;
  error: boolean;
  conversationId: string | null;
}) {
  const t = useTranslation(),
    p = s.planning!,
    sum = planningSummary(p),
    warnings = planningWarnings(p),
    stale = planningIsStale(s);
  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div>
          <h2>{t("规划摘要")}</h2>
          <small>
            {t(
              s.batchConfirmation === "confirmed"
                ? "已交接 · 只读"
                : stale
                  ? "待更新"
                  : "模拟估算",
            )}
          </small>
        </div>
      </header>
      <div className={styles.body}>
        <div className={styles.summary}>
          <span>
            {t("可纳入")}
            <strong>
              {p.batches.length ? sum.included : p.baselineEligibleIds.length}
            </strong>
          </span>
          <span>
            {t("批次数")}
            <strong>{p.batches.length || t("待生成")}</strong>
          </span>
          <span>
            {t("预计周期")}
            <strong>
              {p.batches.length ? `${sum.days} ${t("天")}` : t("待生成")}
            </strong>
          </span>
        </div>
        <p className={styles.notice}>
          {t(
            "业务属性和依赖可以稍后补充。完整批次、资源需求和时间线在迁移规划页面查看。",
          )}
        </p>
        <div className={styles.toolbar}>
          <Button primary onClick={onManage}>
            {t("打开迁移规划页面")} ↗
          </Button>
          <Button
            onClick={() =>
              onDownload(p.batches.length ? "batch-plan" : "planning-template")
            }
          >
            {t(p.batches.length ? "导出规划" : "下载规划模板")}
          </Button>
        </div>
        {warnings.length > 0 && (
          <details>
            <summary>
              {t("待核对事项")} · {warnings.length}
            </summary>
            <ul>
              {warnings.map((w) => (
                <li key={w}>{t(w)}</li>
              ))}
            </ul>
          </details>
        )}
        {!p.preview && (
          <div className={styles.toolbar}>
            <Button
              disabled={locked}
              onClick={() =>
                onView({
                  compactAction:
                    view.compactAction === "conditions"
                      ? undefined
                      : "conditions",
                })
              }
            >
              {t("填写迁移约束")}
            </Button>
            <Button
              disabled={locked || unsaved}
              onClick={() =>
                onView({
                  compactAction:
                    view.compactAction === "import" ? undefined : "import",
                })
              }
            >
              {t("导入资料 / 调整")}
            </Button>
            <Button
              disabled={locked || unsaved || (!!p.batches.length && !stale)}
              onClick={() => void onCommand({ type: "planning.useSample" })}
            >
              {t(stale ? "重新生成模拟初稿" : "生成规划初稿")}
            </Button>
          </div>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {t("操作未完成，输入已保留。请核对最新数据后重试，或取消预览。")}
          </p>
        )}
        {p.preview ? (
          <PlanningPreview
            preview={p.preview}
            canApply={
              p.preview.conversationId === conversationId &&
              s.batchConfirmation !== "confirmed"
            }
            onCommand={onCommand}
          />
        ) : view.compactAction === "conditions" ? (
          <PlanningInputs
            conditionsOnly
            planning={p}
            view={{ ...view, section: "conditions" }}
            onView={onView}
            onSave={onSave}
            locked={locked}
          />
        ) : view.compactAction === "import" ? (
          <div className={styles.editor}>
            <FileField
              label={t("上传规划资料或调整表格")}
              filename={s.planningWorkbook}
              disabled={locked || unsaved}
              onFile={(file) => {
                void onUpload("planning", file).then((ok) => {
                  if (ok) onView({ compactAction: undefined });
                });
              }}
            />
            <p className={styles.muted}>
              {t("展示示例解析结果，尚未读取实际表格内容。已有填写会保留。")}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
