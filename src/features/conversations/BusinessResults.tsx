import type { PanelId } from "@/app/state";
import type { BusinessResult, ProjectSnapshot, StageId } from "@/domain/models";
import { canExecute, stageEligibility } from "@/domain/policies";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { Button, ResultFrame } from "@/shared/ui/primitives";
import { Status } from "@/shared/ui/Status";
import { useState } from "react";
import styles from "./BusinessResults.module.css";
export interface ResultActions {
  onPanel: (panel: PanelId) => void;
  onDownload: (id: string) => void;
  onCommand: (cmd: ProjectCommand) => void;
  onStage: (stage: StageId) => void;
}
export function BusinessResults({
  results,
  snapshot,
  ...actions
}: { results: BusinessResult[]; snapshot: ProjectSnapshot } & ResultActions) {
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
}: { result: BusinessResult; snapshot: ProjectSnapshot } & ResultActions) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [review, setReview] = useState(false);
  if (r.kind === "summary")
    return (
      <ResultFrame
        title={t(r.title)}
        actions={
          <>
            <Button onClick={() => onPanel("risk")}>{t("查看风险")}</Button>
            {r.stageId === "planning" && (
              <Button onClick={() => onPanel("tasks")}>{t("打开计划")}</Button>
            )}
          </>
        }
      >
        <dl className={styles.metrics}>
          {r.metrics.map((m) => (
            <div key={m.label}>
              <dt>{t(m.label)}</dt>
              <dd data-tone={m.tone}>{t(m.value)}</dd>
            </div>
          ))}
        </dl>
        {r.detail && <p>{t(r.detail)}</p>}
      </ResultFrame>
    );
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
                {t("确认并继续")}
              </Button>
              <Button onClick={() => setReview(false)}>{t("暂不执行")}</Button>
            </>
          ) : (
            <Button disabled={!allowed} onClick={() => setReview(true)}>
              {t("查看确认事项")}
            </Button>
          )
        }
      >
        <p>{t(a.description)}</p>
        {review && (
          <ul className={styles.checks}>
            {a.checks.map((c) => (
              <li key={c}>
                <Icon name="check" size={13} />
                {t(c)}
              </li>
            ))}
          </ul>
        )}
      </ResultFrame>
    );
  }
  const rows =
    r.kind === "artifacts"
      ? r.artifactIds.flatMap((id) => {
          const a = s.artifacts.find((a) => a.id === id);
          return a
            ? [{ id, title: a.filename, status: "ready", detail: t(a.label) }]
            : [];
        })
      : r.taskIds.map((id, index) => {
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
      title={t(r.kind === "artifacts" ? "交付文件" : r.title)}
      actions={
        <>
          {rows.length > 3 && (
            <Button onClick={() => setExpanded(!expanded)}>
              {t(expanded ? "收起" : "展开其余 {0} 项", rows.length - 3)}
            </Button>
          )}
          <Button
            onClick={() =>
              onPanel(r.kind === "artifacts" ? "deliverables" : r.taskKind)
            }
          >
            {t(r.kind === "artifacts" ? "打开交付件列表" : "查看任务")}
          </Button>
        </>
      }
    >
      <div className={styles.rows}>
        {(expanded ? rows : rows.slice(0, 3)).map((row) => (
          <div className={styles.row} key={row.id}>
            <Icon name={r.kind === "artifacts" ? "file" : "tasks"} size={16} />
            <div>
              <strong>{row.title}</strong>
              {row.detail && <small>{row.detail}</small>}
            </div>
            {r.kind === "artifacts" ? (
              <Button
                aria-label={`${t("下载")} ${row.title}`}
                onClick={() => onDownload(row.id)}
              >
                <Icon name="download" size={14} />
                {t("下载")}
              </Button>
            ) : (
              <Status value={row.status} />
            )}
          </div>
        ))}
      </div>
    </ResultFrame>
  );
}
