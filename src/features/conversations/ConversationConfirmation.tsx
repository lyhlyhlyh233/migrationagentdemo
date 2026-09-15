import { useEffect, useRef, useState } from "react";
import type { ProjectSnapshot, StageId } from "@/domain/models";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import {
  actionLabels,
  executionBlock,
  type ExecutionAction,
} from "@/domain/execution";
import { stageEligibility } from "@/domain/policies";
import { PlanningPreview } from "@/features/planning/PlanningPreview";
import { ExecutionPreview } from "@/features/migration/ExecutionPreview";
import { ExecutionIssueEditor } from "@/features/migration/ExecutionIssues";
import type { ExecutionView } from "@/features/migration/state";
import { useTranslation } from "@/shared/i18n";
import { Button, Field } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/Select";
import { Icon } from "@/shared/ui/icons";
import type { ConversationConfirmation as Confirmation } from "./state";
import styles from "./Confirmation.module.css";

export function ConversationConfirmation({
  value,
  onChange,
  snapshot,
  conversationId,
  executionView,
  onExecutionView,
  onCommand,
  onUpload,
  onDownload,
  onStage,
  onClose,
}: {
  value: Confirmation;
  onChange: (value: Confirmation) => void;
  snapshot: ProjectSnapshot;
  conversationId: string;
  executionView: ExecutionView;
  onExecutionView: (patch: Partial<ExecutionView>) => void;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
  onUpload: (purpose: FilePurpose, file: File) => Promise<boolean>;
  onDownload: (id: string) => void;
  onStage: (stage: StageId) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLTextAreaElement>(".composer-area textarea")
          ?.focus({ preventScroll: true }),
      );
    };
  }, []);
  const command = async (cmd: ProjectCommand) => {
    if (busy) return false;
    setBusy(true);
    setError(false);
    const ok = await onCommand(cmd);
    setBusy(false);
    setError(!ok);
    if (
      ok &&
      (cmd.type === "execution.apply" ||
        cmd.type === "execution.cancel" ||
        cmd.type === "planning.apply" ||
        cmd.type === "planning.cancel")
    )
      onClose();
    return ok;
  };
  const approval =
    value.kind === "stage"
      ? snapshot.approvals.find((a) => a.id === value.id)
      : undefined;
  return (
    <div
      ref={ref}
      className={styles.root}
      tabIndex={-1}
      role="region"
      aria-label={t("对话操作确认")}
    >
      {value.kind === "planning" &&
        snapshot.planning?.preview?.id === value.id && (
          <PlanningPreview
            preview={snapshot.planning.preview}
            onCommand={command}
            canApply={snapshot.batchConfirmation !== "confirmed"}
          />
        )}
      {value.kind === "execution" &&
        snapshot.execution?.preview?.id === value.id && (
          <ExecutionPreview
            preview={snapshot.execution.preview}
            conversationId={conversationId}
            busy={busy}
            onCommand={command}
          />
        )}
      {value.kind === "issue" && (
        <ExecutionIssueEditor
          snapshot={snapshot}
          issueId={value.id}
          view={executionView}
          onView={onExecutionView}
          onCommand={command}
          onUpload={onUpload}
          onDownload={onDownload}
          onCancel={onClose}
          onDone={onClose}
          busy={busy}
        />
      )}
      {value.kind === "tasks" && (
        <TaskChoices
          snapshot={snapshot}
          taskIds={value.taskIds}
          action={value.action}
          onAction={(action) => onChange({ ...value, action })}
          view={executionView}
          onView={onExecutionView}
          onCommand={command}
          busy={busy}
          onClose={onClose}
        />
      )}
      {approval?.action.kind === "stage" && (
        <section className={styles.body}>
          <h3>{t(approval.title)}</h3>
          <p>{t(approval.description)}</p>
          <ul className={styles.checks}>
            {approval.checks.map((check) => (
              <li key={check}>{t(check)}</li>
            ))}
          </ul>
          <div className={styles.actions}>
            <Button disabled={busy} onClick={onClose}>
              {t("暂不执行")}
            </Button>
            <Button
              primary
              disabled={
                busy || !stageEligibility(snapshot)[approval.action.target]
              }
              onClick={async () => {
                if (approval.action.kind !== "stage") return;
                setBusy(true);
                setError(false);
                const ok = await onStage(approval.action.target);
                setBusy(false);
                setError(!ok);
                if (ok) onClose();
              }}
            >
              {t(busy ? "正在应用" : "确认范围并继续")}
              <Icon name="right" size={15} />
            </Button>
          </div>
        </section>
      )}
      {error && (value.kind === "tasks" || value.kind === "stage") && (
        <section>
          <p role="alert" className={styles.error}>
            {t("操作未完成，输入已保留。请核对最新数据后重试，或取消预览。")}
          </p>
        </section>
      )}
    </div>
  );
}

function TaskChoices({
  snapshot,
  taskIds,
  action: selectedAction,
  onAction,
  view,
  onView,
  onCommand,
  busy,
  onClose,
}: {
  snapshot: ProjectSnapshot;
  taskIds: string[];
  view: ExecutionView;
  action?: ExecutionAction;
  onAction: (action: ExecutionAction) => void;
  onView: (patch: Partial<ExecutionView>) => void;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
  busy: boolean;
  onClose: () => void;
}) {
  const t = useTranslation();
  const ids = new Set(taskIds);
  const tasks =
    snapshot.execution?.tasks.filter((task) => ids.has(task.id)) ?? [];
  const actions: ExecutionAction[] = [
    "start",
    "full",
    "increment",
    "cutover",
    "pause",
    "resume",
    "retry",
    "move",
    "window",
  ];
  const action =
    selectedAction ??
    actions.find((key) =>
      tasks.some((task) => !executionBlock(snapshot, task, key)),
    ) ??
    "start";
  const eligible = tasks.filter(
    (task) => !executionBlock(snapshot, task, action),
  );
  const batches = [...new Set(tasks.map((task) => task.batchId))].join("、");
  return (
    <section className={styles.body}>
      <h3>
        {t("选择下一步操作")} · {batches}
      </h3>
      <span className={styles.scope}>
        {t(
          "固定范围 {0} 台，可操作 {1} 台，跳过 {2} 台",
          tasks.length,
          eligible.length,
          tasks.length - eligible.length,
        )}
      </span>
      <fieldset
        className={styles.options}
        aria-label={t("任务操作")}
        disabled={busy}
      >
        {actions.map((key, index) => {
          const disabled = !tasks.some(
            (task) => !executionBlock(snapshot, task, key),
          );
          return (
            <label
              key={key}
              className={styles.option}
              title={
                disabled
                  ? t(
                      tasks[0]
                        ? (executionBlock(snapshot, tasks[0], key) ?? "")
                        : "未找到所选任务",
                    )
                  : undefined
              }
            >
              <input
                type="radio"
                name="execution-action"
                checked={action === key}
                onChange={() => onAction(key)}
                disabled={disabled}
              />
              <span className={styles.number}>{index + 1}</span>
              <span>{t(actionLabels[key])}</span>
            </label>
          );
        })}
      </fieldset>
      {action === "start" && (
        <div className={styles.fields}>
          <Field
            label={t("目标资源")}
            value={view.computeResource}
            onChange={(e) => onView({ computeResource: e.target.value })}
          />
          <Field
            label={t("网络映射")}
            value={view.network}
            onChange={(e) => onView({ network: e.target.value })}
          />
          <label>
            {t("模拟场景")}
            <Select
              value={view.scenario}
              onValueChange={(scenario) =>
                onView({ scenario: scenario as ExecutionView["scenario"] })
              }
            >
              <option value="normal">{t("正常执行")}</option>
              <option value="network">{t("同步网络异常")}</option>
              <option value="capacity">{t("目标容量不足")}</option>
              <option value="permission">{t("权限不足")}</option>
            </Select>
          </label>
        </div>
      )}
      {action === "move" && (
        <label>
          {t("目标批次")}
          <Select
            value={view.targetBatchId}
            onValueChange={(targetBatchId) => onView({ targetBatchId })}
          >
            <option value="">{t("选择批次")}</option>
            {snapshot.planning?.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.id}
              </option>
            ))}
          </Select>
        </label>
      )}
      {action === "window" && (
        <Field
          label={t("后续割接窗口")}
          value={view.window}
          onChange={(e) => onView({ window: e.target.value })}
        />
      )}
      <div className={styles.actions}>
        <Button disabled={busy} onClick={onClose}>
          {t("取消")}
        </Button>
        <Button
          primary
          disabled={busy || !eligible.length}
          onClick={() =>
            void onCommand({
              type: "execution.preview",
              action,
              taskIds: eligible.map((task) => task.id),
              computeResource: view.computeResource,
              network: view.network,
              scenario: view.scenario,
              targetBatchId: view.targetBatchId,
              window: view.window,
            })
          }
        >
          {t("预览操作")}
          <Icon name="right" size={15} />
        </Button>
      </div>
    </section>
  );
}
