import { useId, useState } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import type { ExecutionView } from "./state";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { Select } from "@/shared/ui/Select";
import { useTranslation } from "@/shared/i18n";
import styles from "./ExecutionIssue.module.css";

export const issueStateLabels: Record<string, string> = {
  collecting: "正在获取日志",
  diagnosing: "正在诊断",
  ready: "待选择方案",
  "log-failed": "日志获取失败",
  inconclusive: "诊断无结论",
  manual: "等待人工处理",
  repairing: "修复与复查中",
  "repair-failed": "修复或复查失败",
  resolved: "已解决",
};
interface IssueProps {
  snapshot: ProjectSnapshot;
  view: ExecutionView;
  onView: (value: Partial<ExecutionView>) => void;
  busy?: boolean;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
  onUpload: (purpose: FilePurpose, file: File) => Promise<boolean>;
  onDownload: (id: string) => void;
}
export function ExecutionIssueEditor({
  snapshot,
  issueId,
  view,
  onView,
  busy = false,
  onCommand,
  onUpload,
  onDownload,
  onCancel,
  onDone,
}: IssueProps & {
  issueId: string;
  onCancel?: () => void;
  onDone?: () => void;
}) {
  const t = useTranslation(),
    id = useId();
  const [pending, setPending] = useState(false),
    [failed, setFailed] = useState(false);
  const issue = snapshot.execution?.issues.find((item) => item.id === issueId);
  if (!issue)
    return (
      <p className={styles.note}>{t("未找到该问题，请刷新当前问题范围。")}</p>
    );
  const working = busy || pending;
  const readonly = [
    "collecting",
    "diagnosing",
    "repairing",
    "resolved",
  ].includes(issue.state);
  const canChoose =
    !readonly && !["log-failed", "inconclusive"].includes(issue.state);
  const requiresRecheck =
    issue.solution === "manual" &&
    ["manual", "repair-failed"].includes(issue.state);
  async function send(command: ProjectCommand, close = false) {
    setPending(true);
    setFailed(false);
    try {
      const ok = await onCommand(command);
      setFailed(!ok);
      if (ok && close) onDone?.();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <div className={styles.heading}>
        <h3 id={`${id}-title`}>{t(issue.title)}</h3>
        <span data-tone={issue.state === "resolved" ? "success" : "warning"}>
          {t(issueStateLabels[issue.state])}
        </span>
      </div>
      <p className={styles.scope}>
        {snapshot
          .execution!.tasks.filter((task) => issue.taskIds.includes(task.id))
          .map((task) => `${task.batchId} / ${task.name}`)
          .join("、")}
      </p>
      <p className={styles.diagnosis}>
        {t(issue.diagnosis || "正在核对模拟日志，请稍候。")}
      </p>
      <details className={styles.evidence}>
        <summary>{t("诊断依据与日志")}</summary>
        <p>{t(issue.evidence)}</p>
        {issue.logId && (
          <Button onClick={() => onDownload(issue.logId!)}>
            <Icon name="download" size={14} />
            {t("下载模拟日志")}
          </Button>
        )}
      </details>
      {canChoose && !requiresRecheck && (
        <fieldset className={styles.options}>
          <legend>{t("选择处理方案")}</legend>
          {(["automatic", "manual"] as const).map((solution, index) => (
            <label
              key={solution}
              data-selected={view.solution === solution}
              data-disabled={
                solution === "automatic" && issue.category !== "network"
              }
            >
              <input
                type="radio"
                name={`${id}-solution`}
                checked={view.solution === solution}
                disabled={
                  working ||
                  (solution === "automatic" && issue.category !== "network")
                }
                onChange={() => onView({ solution })}
              />
              <span className={styles.number}>{index + 1}</span>
              <span>
                <strong>
                  {t(
                    solution === "automatic"
                      ? "自动重建同步通道"
                      : "人工处理后复查",
                  )}
                </strong>
                <small>
                  {t(
                    solution === "automatic"
                      ? issue.category === "network"
                        ? "确认后执行，保留已同步数据。"
                        : "该问题需要人工处理，无法自动执行。"
                      : "记录处理措施与证据，复查通过后恢复任务。",
                  )}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {canChoose && (view.solution === "manual" || requiresRecheck) && (
        <div className={styles.supplement}>
          <label htmlFor={`${id}-note`}>
            {t("处理说明")}
            <textarea
              id={`${id}-note`}
              value={view.note}
              disabled={working}
              onChange={(event) => onView({ note: event.target.value })}
              placeholder={t("记录处理措施与复查依据")}
            />
          </label>
          <label className={styles.upload}>
            {t("补充证据附件")}
            <input
              type="file"
              disabled={working}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setPending(true);
                  void onUpload(`issue:${issue.id}`, file)
                    .then((ok) => setFailed(!ok))
                    .catch(() => setFailed(true))
                    .finally(() => setPending(false));
                }
              }}
            />
          </label>
        </div>
      )}
      {issue.attachments.length > 0 && (
        <div className={styles.attachments}>
          {issue.attachments.map((fileId, index) => (
            <Button key={fileId} onClick={() => onDownload(fileId)}>
              <Icon name="download" size={14} />
              {t("下载证据附件")} {index + 1}
            </Button>
          ))}
        </div>
      )}
      {issue.state !== "resolved" && (
        <details className={styles.simulation}>
          <summary>{t("模拟处理选项")}</summary>
          <div>
            <Select
              value={view.diagnosticFailure}
              disabled={working || readonly}
              onValueChange={(value) =>
                onView({
                  diagnosticFailure:
                    value as ExecutionView["diagnosticFailure"],
                })
              }
            >
              <option value="">{t("正常诊断")}</option>
              <option value="log-failed">{t("日志获取失败")}</option>
              <option value="inconclusive">{t("诊断无结论")}</option>
            </Select>
            <label>
              <input
                type="checkbox"
                disabled={working || readonly}
                checked={view.simulateFailure}
                onChange={(event) =>
                  onView({ simulateFailure: event.target.checked })
                }
              />
              {t("模拟修复或复查失败")}
            </label>
          </div>
        </details>
      )}
      {failed && (
        <p role="alert" className={styles.error}>
          {t("操作未完成，选择与输入已保留，请重试。")}
        </p>
      )}
      <div className={styles.actions}>
        {!readonly && (
          <button
            className={styles.textAction}
            disabled={working}
            onClick={() =>
              void send({
                type: "execution.diagnose",
                issueId,
                simulate: view.diagnosticFailure || undefined,
              })
            }
          >
            {t("重新诊断")}
          </button>
        )}
        {onCancel && (
          <Button disabled={working} onClick={onCancel}>
            {t("取消")}
          </Button>
        )}
        {canChoose && (
          <Button
            primary
            disabled={
              working ||
              (requiresRecheck && view.note.trim().length < 4) ||
              (!requiresRecheck &&
                view.solution === "automatic" &&
                issue.category !== "network")
            }
            onClick={() =>
              void send(
                requiresRecheck
                  ? {
                      type: "execution.recheck",
                      issueId,
                      note: view.note,
                      simulateFailure: view.simulateFailure,
                    }
                  : {
                      type: "execution.remedy",
                      issueId,
                      solution: view.solution,
                      note: view.note,
                      simulateFailure: view.simulateFailure,
                    },
                true,
              )
            }
          >
            {t(
              working
                ? "正在提交"
                : requiresRecheck
                  ? "提交处理并复查"
                  : view.solution === "automatic"
                    ? "确认并执行方案"
                    : "确认采用人工方案",
            )}
            <Icon name="right" size={14} />
          </Button>
        )}
      </div>
    </section>
  );
}
