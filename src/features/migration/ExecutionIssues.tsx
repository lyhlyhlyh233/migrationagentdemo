import { useId, useState } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import type { ExecutionView } from "@/stores/executionState";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { Select } from "@/shared/ui/Select";
import {
  ConfirmationChoices,
  ConfirmationNote,
} from "@/shared/ui/ConfirmationChoices";
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
  demoTools?: boolean;
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
  demoTools = false,
  issueId,
  view,
  onView,
  busy = false,
  onCommand,
  onUpload,
  onDownload,
  onCancel,
  onDone,
  choice,
  onChoice,
  onDefer,
}: IssueProps & {
  issueId: string;
  onCancel?: () => void;
  onDone?: () => void;
  choice?: string;
  onChoice?: (choice: string) => void;
  onDefer?: () => Promise<boolean>;
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
  const selectedSolution =
    issue.category === "network" ? view.solution : "manual";
  const affectedTasks = snapshot.execution!.tasks.filter((task) =>
    issue.taskIds.includes(task.id),
  );
  const diagnosticError = [
    "log-failed",
    "inconclusive",
    "repair-failed",
  ].includes(issue.state);
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
          {t(issueStateLabels[issue.state])} ·{" "}
          {t("{0} 台虚拟机", affectedTasks.length)}
        </span>
      </div>
      {diagnosticError && (
        <p role="alert" className={styles.error}>
          {t(issue.diagnosis || issueStateLabels[issue.state])}
        </p>
      )}
      <details className={styles.evidence}>
        <summary>{t("诊断依据与日志")}</summary>
        <p className={styles.scope}>
          {affectedTasks
            .map((task) => `${task.batchId} / ${task.name}`)
            .join("、")}
        </p>
        {!diagnosticError && (
          <p className={styles.diagnosis}>
            {t(
              issue.diagnosis ||
                (demoTools
                  ? "正在核对模拟日志，请稍候。"
                  : "正在核对日志，请稍候。"),
            )}
          </p>
        )}
        <p>{t(issue.evidence)}</p>
        {(issue.logId || !readonly) && (
          <div className={styles.attachments}>
            {issue.logId && (
              <Button onClick={() => onDownload(issue.logId!)}>
                <Icon name="download" size={14} />
                {t(demoTools ? "下载模拟日志" : "下载日志")}
              </Button>
            )}
            {!readonly && (
              <button
                className={styles.textAction}
                disabled={working}
                onClick={() =>
                  void send({
                    type: "execution.diagnose",
                    issueId,
                    ...(demoTools && view.diagnosticFailure
                      ? { simulate: view.diagnosticFailure }
                      : {}),
                  })
                }
              >
                {t("重新诊断")}
              </button>
            )}
          </div>
        )}
      </details>
      {canChoose && (
        <ConfirmationChoices
          label="选择处理方案"
          value={
            choice ??
            (issue.category === "network" && !requiresRecheck
              ? view.solution
              : "manual")
          }
          disabled={working}
          onChange={(selected) => {
            onChoice?.(selected);
            if (selected === "automatic" || selected === "manual")
              onView({ solution: selected });
          }}
          options={[
            ...(issue.category === "network" && !requiresRecheck
              ? [
                  {
                    value: "automatic",
                    title: "自动重建同步通道",
                    description: "确认后执行，保留已同步数据。",
                    recommended: true,
                  },
                ]
              : []),
            {
              value: "manual",
              title: requiresRecheck ? "提交处理并复查" : "人工处理后复查",
              description: "记录处理措施与证据，复查通过后恢复任务。",
              recommended: issue.category !== "network" || requiresRecheck,
            },
            {
              value: "later",
              title: "稍后处理",
              description: "保持当前问题状态，不执行修复。",
            },
          ]}
        />
      )}
      {canChoose &&
        choice !== "later" &&
        (selectedSolution === "manual" ||
          issue.category !== "network" ||
          requiresRecheck) && (
          <details className={styles.evidence}>
            <summary>{t("补充证据附件")}</summary>
            <label className={styles.upload}>
              <input
                type="file"
                aria-label={t("补充证据附件")}
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
          </details>
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
      {demoTools && issue.state !== "resolved" && (
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
      <ConfirmationNote
        value={view.note}
        onChange={(note) => onView({ note })}
        disabled={working || readonly}
      >
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
              (choice !== "later" &&
                requiresRecheck &&
                !snapshot.demoMode &&
                view.note.trim().length < 4)
            }
            onClick={async () => {
              if (choice === "later") {
                setPending(true);
                setFailed(false);
                try {
                  setFailed(!(await onDefer?.()));
                } catch {
                  setFailed(true);
                } finally {
                  setPending(false);
                }
                return;
              }
              void send(
                requiresRecheck
                  ? {
                      type: "execution.recheck",
                      issueId,
                      note: view.note,
                      ...(demoTools
                        ? { simulateFailure: view.simulateFailure }
                        : {}),
                      confirmation: {
                        choice: "提交处理并复查",
                        note: view.note,
                      },
                    }
                  : {
                      type: "execution.remedy",
                      issueId,
                      solution: selectedSolution,
                      note: view.note,
                      ...(demoTools
                        ? { simulateFailure: view.simulateFailure }
                        : {}),
                      confirmation: {
                        choice:
                          issue.category === "network" &&
                          selectedSolution === "automatic"
                            ? "自动重建同步通道"
                            : "人工处理后复查",
                        note: view.note,
                      },
                    },
                true,
              );
            }}
          >
            {t(
              working
                ? "正在提交"
                : choice === "later"
                  ? "稍后处理"
                  : requiresRecheck
                    ? "提交处理并复查"
                    : selectedSolution === "automatic"
                      ? "确认并执行方案"
                      : "确认采用人工方案",
            )}
            <Icon name="right" size={14} />
          </Button>
        )}
      </ConfirmationNote>
    </section>
  );
}
