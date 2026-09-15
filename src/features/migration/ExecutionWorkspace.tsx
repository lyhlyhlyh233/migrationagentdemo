import { Fragment } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import {
  executionSummary,
  phaseLabels,
  type ExecutionTask,
} from "@/domain/execution";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { Select } from "@/shared/ui/Select";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow } from "@/shared/ui/pagination-state";
import { useTranslation } from "@/shared/i18n";
import { ExecutionDashboard } from "./ExecutionDashboard";
import type { ExecutionView } from "./state";
import styles from "./Execution.module.css";

export type ExecutionRequest =
  | { kind: "connection" }
  | { kind: "issue"; issueId: string }
  | { kind: "tasks"; taskIds: string[] };
export interface ExecutionWorkspaceProps {
  snapshot: ProjectSnapshot;
  view: ExecutionView;
  onView: (value: Partial<ExecutionView>) => void;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
  onDownload: (id: string) => void;
  onUpload: (purpose: FilePurpose, file: File) => Promise<boolean>;
  conversationId: string | null;
  compact?: boolean;
  onManage?: () => void;
  onContext?: (label: string) => void;
  onRequest?: (request: ExecutionRequest) => void;
}
export function ExecutionWorkspace({
  snapshot: s,
  view: v,
  onView,
  onDownload,
  compact = false,
  onContext,
  onRequest,
}: ExecutionWorkspaceProps) {
  const t = useTranslation(),
    e = s.execution;
  if (!e)
    return (
      <section className={styles.root}>
        <div className={styles.empty}>
          {t("规划确认交接后，可以配置 Migration 连接并启动批次。")}
        </div>
      </section>
    );
  const selectBatch = (id: string) => {
    onView({ batchId: id, dashboardPage: 1, selected: [] });
    onContext?.(`${t("批次")} ${id}`);
  };
  if (compact)
    return (
      <section className={styles.root} aria-label={t("迁移实施工作区")}>
        <div className={styles.body}>
          <ExecutionDashboard
            execution={e}
            selectedBatchId={v.batchId}
            onBatch={selectBatch}
            taskPage={v.dashboardPage}
            taskSize={v.dashboardSize}
            onPage={({ page, size }) =>
              onView({ dashboardPage: page, dashboardSize: size })
            }
            onTask={(id) => {
              const task = e.tasks.find((item) => item.id === id);
              if (task) {
                onContext?.(`${task.batchId} · ${task.name}`);
                onView({ selected: [task.id] });
              }
            }}
            onIssue={(issueId) => onRequest?.({ kind: "issue", issueId })}
          />
        </div>
      </section>
    );
  const validationByTask = new Map(
    e.validations.map((record) => [record.taskId, record]),
  );
  const summary = executionSummary(e),
    locked = !!e.preview;
  const filtered = e.tasks.filter(
    (task) =>
      (!v.batchId || task.batchId === v.batchId) &&
      (!v.status || task.phase === v.status) &&
      `${task.name} ${task.batchId} ${task.system}`
        .toLowerCase()
        .includes(v.query.toLowerCase()),
  );
  const rows: { id: string; label: string; tasks: ExecutionTask[] }[] =
    v.mode === "batches"
      ? [...new Set(filtered.map((task) => task.batchId))].map((id) => ({
          id,
          label: id,
          tasks: filtered.filter((task) => task.batchId === id),
        }))
      : filtered.map((task) => ({
          id: task.id,
          label: task.name,
          tasks: [task],
        }));
  const range = pageWindow(rows.length, { page: v.page, size: v.size });
  const page = rows.slice(range.start, range.end),
    pageIds = page.flatMap((row) => row.tasks.map((task) => task.id));
  const toggle = (ids: string[], checked: boolean) =>
    onView({
      selected: checked
        ? [...new Set([...v.selected, ...ids])]
        : v.selected.filter((id) => !ids.includes(id)),
    });
  const reset = (patch: Partial<ExecutionView>) =>
    onView({ ...patch, page: 1, selected: [] });
  return (
    <section className={styles.root} aria-label={t("迁移任务工作区")}>
      <header className={styles.header}>
        <div>
          <h2>{t("迁移任务")}</h2>
          <small>{t("前端模拟")}</small>
        </div>
        <span className={styles.muted}>{t("操作与确认在右侧对话中完成")}</span>
      </header>
      <div className={styles.body}>
        <div className={styles.summary}>
          <span>
            {t("纳入")}
            <strong>{summary.total}</strong>
          </span>
          <span>
            {t("同步中")}
            <strong data-tone="info">{summary.syncing}</strong>
          </span>
          <span>
            {t("割接中")}
            <strong data-tone="warning">
              {e.tasks.filter((task) => task.phase === "cutover").length}
            </strong>
          </span>
          <span>
            {t("割接完成")}
            <strong data-tone="success">{summary.cutover}</strong>
          </span>
          <span>
            {t("异常")}
            <strong data-tone="danger">{summary.failed}</strong>
          </span>
          <span>
            {t("业务通过")}
            <strong>{summary.passed}</strong>
          </span>
        </div>
        <div className={styles.trend}>
          <div>
            <span>{t("同步速率趋势 · 模拟")}</span>
            <span>{e.trend.at(-1)?.speed ?? 0} MB/s</span>
          </div>
          <svg
            viewBox="0 0 600 70"
            preserveAspectRatio="none"
            role="img"
            aria-label={t("最近 30 秒同步速率")}
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              points={e.trend
                .map(
                  (point, index) =>
                    `${(index * 600) / Math.max(1, e.trend.length - 1)},${65 - (point.speed / Math.max(1, ...e.trend.map((sample) => sample.speed))) * 55}`,
                )
                .join(" ")}
            />
          </svg>
        </div>
        {e.connectionStatus !== "ready" && (
          <p className={styles.notice}>
            {t("连接不可用，请在对话中检测 Migration 连接。")}
            <Button onClick={() => onRequest?.({ kind: "connection" })}>
              {t("配置连接")}
              <Icon name="right" size={14} />
            </Button>
          </p>
        )}
        <div className={styles.toolbar}>
          <Select
            aria-label={t("任务分组")}
            value={v.mode}
            disabled={locked}
            onValueChange={(mode) =>
              reset({ mode: mode as ExecutionView["mode"] })
            }
          >
            <option value="batches">{t("按批次")}</option>
            <option value="vms">{t("按虚拟机")}</option>
          </Select>
          <Select
            aria-label={t("批次筛选")}
            value={v.batchId}
            disabled={locked}
            onValueChange={(batchId) => reset({ batchId })}
          >
            <option value="">{t("全部批次")}</option>
            {s.planning?.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.id}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t("任务状态")}
            value={v.status}
            disabled={locked}
            onValueChange={(status) => reset({ status })}
          >
            <option value="">{t("全部状态")}</option>
            {Object.entries(phaseLabels).map(([phase, label]) => (
              <option key={phase} value={phase}>
                {t(label)}
              </option>
            ))}
          </Select>
          <input
            type="search"
            aria-label={t("搜索批次、虚拟机或业务系统")}
            placeholder={t("搜索批次、虚拟机或业务系统")}
            value={v.query}
            disabled={locked}
            onChange={(event) => reset({ query: event.target.value })}
          />
        </div>
        <div className={styles.toolbar}>
          <span>{t("已选 {0} 台虚拟机", v.selected.length)}</span>
          <Button
            disabled={locked || !filtered.length}
            onClick={() =>
              toggle(
                filtered.map((task) => task.id),
                true,
              )
            }
          >
            {t("选择全部筛选结果")}
          </Button>
          <Button
            disabled={locked || !v.selected.length}
            onClick={() => onView({ selected: [] })}
          >
            {t("清空选择")}
          </Button>
          <Button
            primary
            disabled={locked || !v.selected.length || e.finalized}
            onClick={() =>
              onRequest?.({ kind: "tasks", taskIds: [...v.selected] })
            }
          >
            {t("在对话中操作")}
            <Icon name="right" size={14} />
          </Button>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label={t("选择本页")}
                  disabled={locked || !pageIds.length}
                  checked={
                    pageIds.length > 0 &&
                    pageIds.every((id) => v.selected.includes(id))
                  }
                  ref={(input) => {
                    if (input)
                      input.indeterminate =
                        pageIds.some((id) => v.selected.includes(id)) &&
                        !pageIds.every((id) => v.selected.includes(id));
                  }}
                  onChange={(event) => toggle(pageIds, event.target.checked)}
                />
              </th>
              <th>{t(v.mode === "batches" ? "批次" : "虚拟机")}</th>
              <th>{t("执行状态")}</th>
              <th>{t("割接窗口")}</th>
              <th>{t("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {page.map((row) => {
              const ids = row.tasks.map((task) => task.id),
                done = row.tasks.filter(
                  (task) => task.phase === "validation",
                ).length,
                failed = row.tasks.filter(
                  (task) => task.phase === "failed",
                ).length;
              const issue = e.issues.find(
                (item) =>
                  item.taskIds.some((id) => ids.includes(id)) &&
                  item.state !== "resolved",
              );
              return (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={t("选择 {0}", row.label)}
                        disabled={locked}
                        checked={ids.every((id) => v.selected.includes(id))}
                        ref={(input) => {
                          if (input)
                            input.indeterminate =
                              ids.some((id) => v.selected.includes(id)) &&
                              !ids.every((id) => v.selected.includes(id));
                        }}
                        onChange={(event) => toggle(ids, event.target.checked)}
                      />
                    </td>
                    <td
                      data-label={t(v.mode === "batches" ? "批次" : "虚拟机")}
                    >
                      <strong>{row.label}</strong>
                      <small>
                        {v.mode === "batches"
                          ? t("{0} 台虚拟机", row.tasks.length)
                          : row.tasks[0].assetId}
                      </small>
                    </td>
                    <td data-label={t("执行状态")}>
                      {v.mode === "vms" ? (
                        <span
                          data-tone={
                            failed ? "danger" : done ? "success" : "info"
                          }
                        >
                          {t(
                            row.tasks[0].phase === "validation"
                              ? validationByTask.get(row.id)?.business ===
                                "passed"
                                ? "业务通过"
                                : validationByTask.get(row.id)?.business ===
                                    "failed"
                                  ? "业务不通过"
                                  : "待业务验证"
                              : phaseLabels[row.tasks[0].phase],
                          )}
                        </span>
                      ) : (
                        <>
                          <span>
                            {done} / {row.tasks.length} {t("已割接")}
                          </span>
                          <div className={styles.progress}>
                            <span
                              data-tone="success"
                              style={{ width: `${(done / ids.length) * 100}%` }}
                            />
                            <span
                              data-tone="danger"
                              style={{
                                width: `${(failed / ids.length) * 100}%`,
                              }}
                            />
                            <span
                              style={{
                                width: `${(row.tasks.filter((task) => ["full", "incremental", "ready"].includes(task.phase)).length / ids.length) * 100}%`,
                              }}
                            />
                          </div>
                        </>
                      )}
                      {failed > 0 && v.mode === "batches" && (
                        <small data-tone="danger">
                          {failed} {t("异常")}
                        </small>
                      )}
                    </td>
                    <td data-label={t("割接窗口")}>
                      {[...new Set(row.tasks.map((task) => task.window))].join(
                        "；",
                      )}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <Button
                          onClick={() => {
                            onView(
                              v.mode === "vms"
                                ? {
                                    expandedTask:
                                      v.expandedTask === row.id
                                        ? undefined
                                        : row.id,
                                  }
                                : {
                                    mode: "vms",
                                    batchId: row.tasks[0].batchId,
                                    page: 1,
                                  },
                            );
                            onContext?.(
                              `${row.tasks[0].batchId}${v.mode === "vms" ? ` · ${row.label}` : ""}`,
                            );
                          }}
                        >
                          {t("查看任务")}
                        </Button>
                        {issue && (
                          <Button
                            onClick={() =>
                              onRequest?.({ kind: "issue", issueId: issue.id })
                            }
                          >
                            {t("查看诊断")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {v.mode === "vms" && v.expandedTask === row.id && (
                    <tr>
                      <td colSpan={5}>
                        <dl className={styles.details}>
                          <dt>{t("目标资源池 / 网络映射")}</dt>
                          <dd>
                            {row.tasks[0].computeResource} /{" "}
                            {row.tasks[0].network}
                          </dd>
                          <dt>{t("已同步 / 总量")}</dt>
                          <dd>
                            {Math.round(row.tasks[0].syncedGB)} /{" "}
                            {row.tasks[0].totalGB} GB
                          </dd>
                          <dt>{t("当前同步速率")}</dt>
                          <dd>{row.tasks[0].speed} MB/s</dd>
                          <dt>{t("最近增量同步")}</dt>
                          <dd>
                            {row.tasks[0].lastSync
                              ? new Date(
                                  row.tasks[0].lastSync!,
                                ).toLocaleTimeString()
                              : t("尚未同步")}
                          </dd>
                          <dt>{t("任务创建状态")}</dt>
                          <dd>
                            {t(row.tasks[0].created ? "已创建" : "待创建")}
                          </dd>
                          {issue?.logId && (
                            <>
                              <dt>{t("诊断日志")}</dt>
                              <dd>
                                <Button
                                  onClick={() => onDownload(issue.logId!)}
                                >
                                  <Icon name="download" size={14} />
                                  {t("下载模拟日志")}
                                </Button>
                              </dd>
                            </>
                          )}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className={styles.empty}>{t("暂无符合条件的任务")}</p>
        )}
        <Pagination
          total={rows.length}
          value={{ page: v.page, size: v.size }}
          onChange={onView}
          label={t("执行任务")}
          sizes={[20, 50, 100]}
          compact
          disabled={locked}
        />
      </div>
    </section>
  );
}
