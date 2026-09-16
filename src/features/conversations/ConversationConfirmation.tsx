import { useEffect, useRef, useState } from "react";
import type { ProjectSnapshot, StageId } from "@/domain/models";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import {
  actionLabels,
  executionBlock,
  phaseLabels,
  type ExecutionAction,
  type ExecutionTask,
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
import {
  ConfirmationChoices,
  ConfirmationNote,
} from "@/shared/ui/ConfirmationChoices";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow } from "@/shared/ui/pagination-state";
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
  onStage: (
    stage: StageId,
    confirmation?: { choice: string; note: string },
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const choice = value.choice ?? "apply";
  const note = value.note ?? "";
  const patch = (update: Partial<Confirmation>) =>
    onChange({ ...value, ...update } as Confirmation);
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
  const run = async (work: () => Promise<boolean>, close = false) => {
    if (busy) return false;
    setBusy(true);
    setError(false);
    try {
      const ok = await work();
      setError(!ok);
      if (ok && close) onClose();
      return ok;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const command = (cmd: ProjectCommand) => run(() => onCommand(cmd));
  const record = (subject: string, selected: string) =>
    run(
      () =>
        onCommand({
          type: "confirmation.record",
          subject,
          choice: selected,
          note,
        }),
      true,
    );
  const approval =
    value.kind === "stage"
      ? snapshot.approvals.find((a) => a.id === value.id)
      : undefined;
  const planning =
    value.kind === "planning" && snapshot.planning?.preview?.id === value.id
      ? snapshot.planning.preview
      : undefined;
  const execution =
    value.kind === "execution" && snapshot.execution?.preview?.id === value.id
      ? snapshot.execution.preview
      : undefined;
  const importing = planning?.change.kind === "import";
  const planningChoice =
    choice === "edit"
      ? importing
        ? "继续补充"
        : "继续修改"
      : choice === "later"
        ? importing
          ? "暂不导入"
          : "保留原计划"
        : importing
          ? "应用导入资料"
          : "应用建议";
  const scopeIds = value.scopeIds ?? execution?.taskIds ?? [];
  const scopeTasks =
    snapshot.execution?.tasks.filter((task) =>
      execution?.taskIds.includes(task.id),
    ) ?? [];
  const noteInput = (
    <ConfirmationNote
      value={note}
      onChange={(note) => patch({ note })}
      disabled={busy}
    />
  );
  return (
    <div
      ref={ref}
      className={styles.root}
      tabIndex={-1}
      role="region"
      aria-label={t("对话操作确认")}
    >
      {planning && (
        <section className={styles.body}>
          <h3>
            {t(importing ? "如何处理这次导入资料？" : "如何处理这次规划调整？")}
          </h3>
          <details className={styles.details}>
            <summary>
              {t("查看修改前后 · {0} 项", planning.rows.length)}
            </summary>
            <PlanningPreview
              preview={planning}
              onCommand={command}
              canApply={snapshot.batchConfirmation !== "confirmed"}
              summaryOnly
            />
          </details>
          <ConfirmationChoices
            value={choice}
            onChange={(choice) => patch({ choice })}
            disabled={busy}
            options={[
              {
                value: "apply",
                title: importing ? "应用导入资料" : "应用建议",
                description: importing
                  ? "补充业务属性与基础约束，已有填写将保留。"
                  : "采用当前预览，更新规划结果。",
                recommended: true,
              },
              {
                value: "edit",
                title: importing ? "继续补充" : "继续修改",
                description: importing
                  ? "暂不应用本次导入，返回对话补充资料。"
                  : "返回对话补充要求，当前计划保持不变。",
              },
              {
                value: "later",
                title: importing ? "暂不导入" : "保留原计划",
                description: importing
                  ? "取消预览，保留现有规划资料。"
                  : "取消本次调整，保留已确认的安排。",
              },
            ]}
          />
          {noteInput}
          <div className={styles.actions}>
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    onCommand({
                      type: "planning.cancel",
                      previewId: planning.id,
                      confirmation: { choice: "取消", note },
                    }),
                  true,
                )
              }
            >
              {t("取消")}
            </Button>
            <Button
              primary
              disabled={busy || snapshot.batchConfirmation === "confirmed"}
              onClick={() => {
                void run(
                  () =>
                    onCommand({
                      type:
                        choice !== "apply"
                          ? "planning.cancel"
                          : "planning.apply",
                      previewId: planning.id,
                      confirmation: {
                        choice: planningChoice,
                        note,
                      },
                    }),
                  true,
                );
              }}
            >
              {t(
                busy
                  ? "正在保存"
                  : !importing && choice === "apply"
                    ? "应用调整"
                    : planningChoice,
              )}
              <Icon name="right" size={15} />
            </Button>
          </div>
        </section>
      )}
      {execution && (
        <section className={styles.body}>
          <h3>{t("是否确认{0}？", t(actionLabels[execution.action]))}</h3>
          <span className={styles.scope}>
            {t("当前范围：{0} 台虚拟机", execution.taskIds.length)}
          </span>
          <details className={styles.details}>
            <summary>{t("查看操作影响")}</summary>
            <ExecutionPreview
              preview={execution}
              conversationId={conversationId}
              busy={busy}
              onCommand={command}
              summaryOnly
            />
          </details>
          <ConfirmationChoices
            value={choice}
            onChange={(choice) => patch({ choice })}
            disabled={busy}
            options={[
              {
                value: "apply",
                title: "执行当前操作",
                description: "按当前预览范围执行，其他任务保持原状态。",
                recommended: true,
              },
              {
                value: "scope",
                title: "调整操作范围",
                description: "选择本次需要处理的虚拟机，再查看新的预览。",
              },
              {
                value: "later",
                title: "暂不执行",
                description: "保留当前任务状态，稍后再处理。",
              },
            ]}
          />
          {choice === "scope" && (
            <ScopePicker
              tasks={scopeTasks}
              selected={scopeIds}
              page={value.scopePage ?? 1}
              onPage={(scopePage) => patch({ scopePage })}
              onChange={(scopeIds) => patch({ scopeIds })}
              disabled={busy}
            />
          )}
          {noteInput}
          <div className={styles.actions}>
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    onCommand({
                      type: "execution.cancel",
                      previewId: execution.id,
                      confirmation: { choice: "取消", note },
                    }),
                  true,
                )
              }
            >
              {t("取消")}
            </Button>
            <Button
              primary
              disabled={
                busy ||
                execution.origin.conversationId !== conversationId ||
                (choice === "scope" && !scopeIds.length)
              }
              onClick={() => {
                if (choice === "scope")
                  void command({
                    type: "execution.preview",
                    replacePreviewId: execution.id,
                    action: execution.action,
                    taskIds: scopeIds,
                    targetBatchId: execution.targetBatchId,
                    window: execution.window,
                    computeResource: execution.computeResource,
                    network: execution.network,
                    scenario: execution.scenario,
                  });
                else
                  void run(
                    () =>
                      onCommand({
                        type:
                          choice === "later"
                            ? "execution.cancel"
                            : "execution.apply",
                        previewId: execution.id,
                        confirmation: {
                          choice:
                            choice === "later" ? "暂不执行" : "执行当前操作",
                          note,
                        },
                      }),
                    true,
                  );
              }}
            >
              {t(
                busy
                  ? "正在应用"
                  : choice === "scope"
                    ? "预览所选范围"
                    : choice === "later"
                      ? "暂不执行"
                      : "确认应用",
              )}
              <Icon name="right" size={15} />
            </Button>
          </div>
        </section>
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
          choice={value.choice}
          onChoice={(choice) => patch({ choice })}
          onDefer={() =>
            run(
              () =>
                onCommand({
                  type: "confirmation.record",
                  subject: "故障处理",
                  choice: "稍后处理",
                  note: executionView.note,
                }),
              true,
            )
          }
        />
      )}
      {value.kind === "tasks" && (
        <TaskChoices
          snapshot={snapshot}
          value={value}
          onChange={onChange}
          view={executionView}
          onView={onExecutionView}
          onCommand={command}
          onDefer={() => record("任务操作", "暂不执行")}
          busy={busy}
          onClose={onClose}
        />
      )}
      {approval?.action.kind === "stage" && (
        <section className={styles.body}>
          <h3>{t(approval.title)}</h3>
          <p className={styles.scope}>{t(approval.description)}</p>
          <details className={styles.details}>
            <summary>{t("查看交接范围")}</summary>
            <ul className={styles.checks}>
              {approval.checks.map((check) => (
                <li key={check}>{t(check)}</li>
              ))}
            </ul>
          </details>
          <ConfirmationChoices
            value={choice}
            onChange={(choice) => patch({ choice })}
            disabled={busy}
            options={[
              {
                value: "apply",
                title: "继续下一阶段",
                description: "确认当前范围，进入下一阶段继续演示。",
                recommended: true,
              },
              {
                value: "later",
                title: "留在当前阶段",
                description: "保持当前进度，继续核对或补充信息。",
              },
            ]}
          />
          {noteInput}
          <div className={styles.actions}>
            <Button disabled={busy} onClick={onClose}>
              {t("取消")}
            </Button>
            <Button
              primary
              disabled={
                busy ||
                (choice === "apply" &&
                  !snapshot.demoMode &&
                  !stageEligibility(snapshot)[approval.action.target])
              }
              onClick={() => {
                if (choice === "later")
                  void record(approval.title, "留在当前阶段");
                else if (approval.action.kind === "stage") {
                  const target = approval.action.target;
                  void run(
                    () => onStage(target, { choice: "继续下一阶段", note }),
                    true,
                  );
                }
              }}
            >
              {t(
                busy
                  ? "正在应用"
                  : choice === "later"
                    ? "留在当前阶段"
                    : "确认范围并继续",
              )}
              <Icon name="right" size={15} />
            </Button>
          </div>
        </section>
      )}
      {error && value.kind !== "issue" && (
        <p role="alert" className={styles.error}>
          {t("操作未完成，输入已保留。请核对最新数据后重试，或取消预览。")}
        </p>
      )}
    </div>
  );
}

function TaskChoices({
  snapshot,
  value,
  onChange,
  view,
  onView,
  onCommand,
  onDefer,
  busy,
  onClose,
}: {
  snapshot: ProjectSnapshot;
  value: Extract<Confirmation, { kind: "tasks" }>;
  onChange: (value: Confirmation) => void;
  view: ExecutionView;
  onView: (patch: Partial<ExecutionView>) => void;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
  onDefer: () => Promise<boolean>;
  busy: boolean;
  onClose: () => void;
}) {
  const t = useTranslation();
  const tasks =
    snapshot.execution?.tasks.filter((task) =>
      value.taskIds.includes(task.id),
    ) ?? [];
  const actions: ExecutionAction[] = [
    "retry",
    "resume",
    "start",
    "full",
    "increment",
    "cutover",
    "pause",
    "move",
    "window",
  ];
  const action =
    value.action ??
    actions.find((key) =>
      tasks.some((task) => !executionBlock(snapshot, task, key)),
    ) ??
    "start";
  const eligible = tasks.filter(
    (task) => !executionBlock(snapshot, task, action),
  );
  const chosenIds = value.scopeIds ?? eligible.map((task) => task.id);
  const chosen = eligible.filter((task) => chosenIds.includes(task.id));
  const choice = value.choice ?? "apply";
  const batches = [...new Set(tasks.map((task) => task.batchId))].join("、");
  return (
    <section className={styles.body}>
      <h3>
        {t("是否{0}？", t(actionLabels[action]))} · {batches}
      </h3>
      <span className={styles.scope}>
        {t(
          "固定范围 {0} 台，可操作 {1} 台，跳过 {2} 台",
          tasks.length,
          eligible.length,
          tasks.length - eligible.length,
        )}
      </span>
      <ConfirmationChoices
        value={choice}
        onChange={(choice) => onChange({ ...value, choice })}
        disabled={busy}
        options={[
          {
            value: "apply",
            title: "执行当前操作",
            description: t(
              "{0}，提交前会展示操作预览。",
              t(actionLabels[action]),
            ),
            recommended: true,
          },
          {
            value: "scope",
            title: "调整操作范围",
            description: "从当前范围中选择虚拟机，其他对象不受影响。",
          },
          {
            value: "later",
            title: "暂不执行",
            description: "保留当前任务状态，稍后再处理。",
          },
        ]}
      />
      {choice === "scope" && (
        <ScopePicker
          tasks={eligible}
          selected={chosenIds}
          page={value.scopePage ?? 1}
          onPage={(scopePage) => onChange({ ...value, scopePage })}
          onChange={(scopeIds) => onChange({ ...value, scopeIds })}
          disabled={busy}
        />
      )}
      {choice !== "later" && action === "start" && (
        <details className={styles.details}>
          <summary>{t("任务配置")}</summary>
          <div className={styles.fields}>
            <Field
              label={t("目标资源")}
              value={view.computeResource}
              onChange={(event) =>
                onView({ computeResource: event.target.value })
              }
            />
            <Field
              label={t("网络映射")}
              value={view.network}
              onChange={(event) => onView({ network: event.target.value })}
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
        </details>
      )}
      {choice !== "later" && action === "move" && (
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
      {choice !== "later" && action === "window" && (
        <Field
          label={t("后续割接窗口")}
          value={view.window}
          onChange={(event) => onView({ window: event.target.value })}
        />
      )}
      <ConfirmationNote
        value={value.note ?? ""}
        onChange={(note) => onChange({ ...value, note })}
        disabled={busy}
      />
      <div className={styles.actions}>
        <Button disabled={busy} onClick={onClose}>
          {t("取消")}
        </Button>
        <Button
          primary
          disabled={busy || (choice !== "later" && !chosen.length)}
          onClick={() => {
            if (choice === "later") void onDefer();
            else
              void onCommand({
                type: "execution.preview",
                action,
                taskIds: chosen.map((task) => task.id),
                computeResource: view.computeResource,
                network: view.network,
                scenario: view.scenario,
                targetBatchId: view.targetBatchId,
                window: view.window,
              });
          }}
        >
          {t(choice === "later" ? "暂不执行" : "预览操作")}
          <Icon name="right" size={15} />
        </Button>
      </div>
    </section>
  );
}

function ScopePicker({
  tasks,
  selected,
  onChange,
  page,
  onPage,
  disabled,
}: {
  tasks: ExecutionTask[];
  selected: string[];
  onChange: (ids: string[]) => void;
  page: number;
  onPage: (page: number) => void;
  disabled: boolean;
}) {
  const t = useTranslation();
  const range = pageWindow(tasks.length, { page, size: 10 });
  const visible = tasks.slice(range.start, range.end);
  return (
    <div className={styles.scopePicker}>
      <div className={styles.scopeHeading}>
        <strong>{t("已选 {0} 台虚拟机", selected.length)}</strong>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange(
              selected.length === tasks.length
                ? []
                : tasks.map((task) => task.id),
            )
          }
        >
          {t(
            selected.length === tasks.length
              ? "清空选择"
              : "选择当前范围全部虚拟机",
          )}
        </button>
      </div>
      <div className={styles.scopeList}>
        {visible.map((task) => (
          <label key={task.id}>
            <input
              type="checkbox"
              checked={selected.includes(task.id)}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...new Set([...selected, task.id])]
                    : selected.filter((id) => id !== task.id),
                )
              }
            />
            <span>{task.name}</span>
            <small>
              {task.batchId} · {t(phaseLabels[task.phase])}
            </small>
          </label>
        ))}
      </div>
      <Pagination
        total={tasks.length}
        value={{ page: range.page, size: 10 }}
        onChange={({ page }) => onPage(page)}
        label={t("操作范围")}
        compact
        disabled={disabled}
        sizes={[10]}
      />
    </div>
  );
}
