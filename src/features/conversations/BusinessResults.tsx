import type { PanelId } from "@/app/state";
import type { BusinessResult, ProjectSnapshot, StageId } from "@/domain/models";
import { canExecute, stageEligibility } from "@/domain/policies";
import { AssessmentForm } from "@/features/research/AssessmentForm";
import type { FilePurpose, ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { Button, ResultFrame } from "@/shared/ui/primitives";
import { Status } from "@/shared/ui/Status";
import { useState } from "react";
import styles from "./BusinessResults.module.css";
export interface ResultActions {
  onPanel: (panel: PanelId) => void;
  onDownload: (id: string) => void;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onStage: (stage: StageId) => void;
  onNavigateStage: (stage: StageId) => void;
  onUpload?: (purpose: FilePurpose, file: File) => void;
  onAsk?: (text: string) => void;
  activeInput?: boolean;
}
export function BusinessResults({
  results,
  snapshot,
  ...actions
}: { results: BusinessResult[]; snapshot: ProjectSnapshot } & ResultActions) {
  const t = useTranslation();
  const assessmentResult = results.some(
    (r) =>
      r.kind === "assessment-decision" ||
      (r.kind === "summary" && r.stageId === "research"),
  );
  const planningEntered = snapshot.enteredStages.includes("planning");
  return (
    <div className={styles.results}>
      {results.map((result, index) => (
        <BusinessResultBlock
          key={index}
          result={result}
          snapshot={snapshot}
          {...actions}
        />
      ))}
      {assessmentResult && (
        <div
          className={styles.quickActions}
          role="group"
          aria-label={t("评估结果快捷操作")}
        >
          <button type="button" onClick={() => actions.onPanel("risk")}>
            <Icon name="shield" size={15} />
            {t("查看&处理风险")}
          </button>
          <button
            type="button"
            disabled={!planningEntered && !stageEligibility(snapshot).planning}
            onClick={() => actions.onNavigateStage("planning")}
          >
            {t(planningEntered ? "打开规划设计" : "继续下一步规划设计")}
            <Icon name="right" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function BusinessResultBlock({
  result: r,
  snapshot: s,
  onPanel,
  onDownload,
  onCommand,
  onStage,
  onUpload,
  activeInput = false,
}: { result: BusinessResult; snapshot: ProjectSnapshot } & ResultActions) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [review, setReview] = useState(
    r.kind === "approval" &&
      s.approvals.some(
        (a) => a.id === r.approvalId && a.action.kind === "stage",
      ),
  );
  if (r.kind === "assessment-input")
    return activeInput && s.assessmentStatus !== "completed" && onUpload ? (
      <div className={styles.input}>
        <AssessmentForm
          snapshot={s}
          onCommand={onCommand}
          onUpload={onUpload}
          onDownload={onDownload}
          disabled={!!Object.keys(s.pending).length}
        />
      </div>
    ) : (
      <details className={styles.inputHistory}>
        <summary>{t("评估资料记录")}</summary>
        <p>{r.files.rvtools || t("RVTools 待提供")}</p>
        <p>{r.files.presales || t("调研表待提供")}</p>
      </details>
    );
  // Compatibility marker: assessment actions render once below all result blocks.
  if (r.kind === "assessment-decision") return null;
  if (r.kind === "summary")
    return (
      <section className={styles.summary} aria-label={t(r.title)}>
        <dl className={styles.metrics}>
          {r.metrics.map((m) => (
            <div key={m.label}>
              <dt>{t(m.label)}</dt>
              <dd data-tone={m.tone}>{t(m.value)}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.summaryActions}>
          {r.detail && (
            <details>
              <summary>{t("统计口径")}</summary>
              <p>{t(r.detail)}</p>
            </details>
          )}
          {r.stageId !== "research" && (
            <button type="button" onClick={() => onPanel("risk")}>
              {t("查看风险")}
            </button>
          )}
          {r.stageId === "planning" && (
            <button type="button" onClick={() => onPanel("tasks")}>
              {t("打开计划")}
            </button>
          )}
        </div>
      </section>
    );
  if (r.kind === "artifacts") {
    const files = r.artifactIds.flatMap((id) => {
      const a = s.artifacts.find((v) => v.id === id);
      return a ? [a] : [];
    });
    return (
      <section className={styles.files} aria-label={t("交付文件")}>
        <div className={styles.fileHeading}>
          <span>
            {t("交付文件")} · {files.length}
          </span>
          <button type="button" onClick={() => onPanel("deliverables")}>
            {t("打开交付件列表")}
          </button>
        </div>
        {(expanded ? files : files.slice(0, 3)).map((a) => (
          <div className={styles.fileRow} key={a.id}>
            <Icon name="file" size={15} />
            <span title={a.filename}>{a.filename}</span>
            <button
              type="button"
              aria-label={`${t("下载")} ${a.filename}`}
              onClick={() => onDownload(a.id)}
            >
              <Icon name="download" size={14} />
              {t("下载")}
            </button>
          </div>
        ))}
        {files.length > 3 && (
          <button
            type="button"
            className={styles.expandFiles}
            onClick={() => setExpanded(!expanded)}
          >
            {t(expanded ? "收起" : "展开其余 {0} 项", files.length - 3)}
          </button>
        )}
      </section>
    );
  }
  if (r.kind === "approval") {
    const a = s.approvals.find((a) => a.id === r.approvalId);
    if (!a) return null;
    const allowed =
      a.status === "pending" &&
      (a.action.kind === "stage"
        ? stageEligibility(s)[a.action.target]
        : canExecute(s, a.action.target));
    return (
      <ResultFrame
        title={t(a.title)}
        actions={
          a.status === "confirmed" ? (
            <Status value="confirmed" />
          ) : review ? (
            <>
              <Button
                primary
                disabled={!allowed}
                onClick={() => {
                  if (a.action.kind === "stage") onStage(a.action.target);
                  else
                    onCommand({
                      type: "execution.confirm",
                      kind: a.action.target,
                    });
                  setReview(false);
                }}
              >
                {t(a.action.kind === "stage" ? "确认范围并继续" : "确认并继续")}
              </Button>
              <Button onClick={() => setReview(false)}>{t("暂不执行")}</Button>
            </>
          ) : (
            <Button onClick={() => setReview(true)}>{t("查看确认事项")}</Button>
          )
        }
      >
        <p>{t(a.description)}</p>
        {review && a.status !== "confirmed" && (
          <ul className={styles.checks}>
            {a.checks.map((c) => (
              <li key={c}>
                <Icon name={allowed ? "check" : "info"} size={13} />
                {t(c)}
              </li>
            ))}
          </ul>
        )}
      </ResultFrame>
    );
  }
  const rows = r.taskIds.map((id, index) => {
    const task =
      r.taskKind === "creation"
        ? s.creationTasks.find((v) => v.id === id)
        : r.taskKind === "sync"
          ? s.batchTasks.find((v) => v.id === id)
          : s.vmTasks.find((v) => v.id === id);
    const metric = s.executionMetrics[r.taskKind];
    const status = !task
      ? "unavailable"
      : "status" in task
        ? task.status
        : index < metric.completed
          ? "succeeded"
          : s.executionApprovals[r.taskKind]
            ? "running"
            : "pending";
    return {
      id,
      title:
        task && "vmName" in task
          ? task.vmName
          : task && "name" in task
            ? task.name
            : id,
      status,
      detail: task && "progress" in task ? `${task.progress}%` : "",
    };
  });
  return (
    <ResultFrame
      title={t(r.title)}
      actions={
        <>
          {rows.length > 3 && (
            <Button onClick={() => setExpanded(!expanded)}>
              {t(expanded ? "收起" : "展开其余 {0} 项", rows.length - 3)}
            </Button>
          )}
          <Button onClick={() => onPanel(r.taskKind)}>{t("查看任务")}</Button>
        </>
      }
    >
      <div className={styles.rows}>
        {(expanded ? rows : rows.slice(0, 3)).map((row) => (
          <div className={styles.row} key={row.id}>
            <Icon name="tasks" size={16} />
            <div>
              <strong>{row.title}</strong>
              {row.detail && <small>{row.detail}</small>}
            </div>
            <Status value={row.status} />
          </div>
        ))}
      </div>
    </ResultFrame>
  );
}
