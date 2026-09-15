import { Fragment, useState } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import {
  actionLabels,
  executionBlock,
  executionSummary,
  phaseLabels,
  hasActiveControl,
  type ExecutionAction,
  type ExecutionTask,
} from "@/domain/execution";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import { Button } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/Select";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow } from "@/shared/ui/pagination-state";
import { useTranslation } from "@/shared/i18n";
import { ExecutionIssues } from "./ExecutionIssues";
import { ExecutionPreview } from "./ExecutionPreview";
import type { ExecutionView } from "./state";
import styles from "./Execution.module.css";
export interface ExecutionWorkspaceProps {
  snapshot: ProjectSnapshot;
  view: ExecutionView;
  onView: (v: Partial<ExecutionView>) => void;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onDownload: (id: string) => void;
  onUpload: (p: FilePurpose, f: File) => Promise<boolean>;
  conversationId: string | null;
  compact?: boolean;
  onContext?: (label: string) => void;
}
export function ExecutionWorkspace({
  snapshot: s,
  view: v,
  onView,
  onCommand,
  onUpload,
  onDownload,
  conversationId,
  compact = false,
  onContext,
}: ExecutionWorkspaceProps) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const e = s.execution;
  async function send(cmd: ProjectCommand) {
    setBusy(true);
    setError(false);
    try {
      const ok = await onCommand(cmd);
      setError(!ok);
      if (ok && cmd.type === "execution.apply") onView({ selected: [] });
      return ok;
    } finally {
      setBusy(false);
    }
  }
  if (!e)
    return (
      <section className={styles.root}>
        <div className={styles.empty}>
          {t("规划确认交接后，可以配置 Migration 连接并启动批次。")}
        </div>
      </section>
    );
  const validationByTask = new Map(e.validations.map((v) => [v.taskId, v]));
  const summary = executionSummary(e),
    locked = busy || !!e.preview || e.finalized;
  const filtered = e.tasks.filter(
    (x) =>
      (!v.batchId || x.batchId === v.batchId) &&
      (!v.status || x.phase === v.status) &&
      `${x.name} ${x.batchId} ${x.system}`
        .toLowerCase()
        .includes(v.query.toLowerCase()),
  );
  const rows: { id: string; label: string; tasks: ExecutionTask[] }[] =
    v.mode === "batches"
      ? [...new Set(filtered.map((x) => x.batchId))].map((id) => ({
          id,
          label: id,
          tasks: filtered.filter((x) => x.batchId === id),
        }))
      : filtered.map((x) => ({ id: x.id, label: x.name, tasks: [x] }));
  const range = pageWindow(rows.length, { page: v.page, size: v.size }),
    page = rows.slice(range.start, range.end);
  const pageIds = page.flatMap((r) => r.tasks.map((t) => t.id));
  const selected = e.tasks.filter((x) => v.selected.includes(x.id));
  const toggle = (ids: string[], checked: boolean) =>
    onView({
      selected: checked
        ? [...new Set([...v.selected, ...ids])]
        : v.selected.filter((id) => !ids.includes(id)),
    });
  const reset = (patch: Partial<ExecutionView>) =>
    onView({ ...patch, page: 1, selected: [] });
  const preview = (action: ExecutionAction, taskIds = v.selected) =>
    send({
      type: "execution.preview",
      action,
      taskIds,
      computeResource: v.computeResource,
      network: v.network,
      targetBatchId: v.targetBatchId,
      window: v.window,
      scenario: v.scenario,
    });
  const conn = v.connectionDraft ?? {
    ip: e.connection?.ip ?? "",
    port: e.connection?.port ?? 443,
    username: e.connection?.username ?? "",
    password: "",
  };
  const field = (key: keyof typeof conn, value: string) =>
    onView({
      connectionDraft: {
        ...conn,
        [key]: key === "port" ? Number(value) : value,
      },
    });
  return (
    <section className={styles.root} aria-label={t("迁移实施工作区")}>
      <header className={styles.header}>
        <div>
          <h2>{t(compact ? "迁移实施" : "迁移任务")}</h2>
          <small>{t("前端模拟")}</small>
        </div>
      </header>
      <nav className={styles.tabs} aria-label={t("实施视图")}>
        {(["connection", "tasks", "issues"] as const).map((tab) => (
          <button
            key={tab}
            aria-pressed={v.tab === tab}
            onClick={() => onView({ tab })}
          >
            {t(
              { connection: "连接配置", tasks: "批次执行", issues: "问题处理" }[
                tab
              ],
            )}
            {tab === "issues" &&
              e.issues.some((i) => i.state !== "resolved") &&
              ` · ${e.issues.filter((i) => i.state !== "resolved").length}`}
          </button>
        ))}
      </nav>
      <div className={styles.body}>
        {error && (
          <p role="alert" className={styles.error}>
            {t("操作未完成，输入与选择已保留。请根据提示调整后重试。")}
          </p>
        )}
        {v.tab === "connection" ? (
          <form
            className={styles.stack}
            onSubmit={(event) => {
              event.preventDefault();
              void send({
                type: "execution.connection",
                values: conn,
                simulateFailure: v.simulateFailure,
              }).then((ok) => {
                if (ok)
                  onView({
                    tab: "tasks",
                    connectionDraft: { ...conn, password: "" },
                  });
              });
            }}
          >
            <div className={styles.notice}>
              {t(
                "检测通过后才允许启动任务。连接与认证仅为模拟，不访问真实服务。",
              )}
            </div>
            <div className={styles.form}>
              <label>
                Migration IP
                <input
                  disabled={e.connectionStatus === "checking"}
                  value={conn.ip}
                  onChange={(x) => field("ip", x.target.value)}
                  placeholder="192.0.2.10"
                  required
                />
              </label>
              <label>
                {t("端口")}
                <input
                  type="number"
                  min={1}
                  max={65535}
                  disabled={e.connectionStatus === "checking"}
                  value={conn.port}
                  onChange={(x) => field("port", x.target.value)}
                  required
                />
              </label>
              <label>
                {t("用户名")}
                <input
                  disabled={e.connectionStatus === "checking"}
                  value={conn.username}
                  autoComplete="off"
                  onChange={(x) => field("username", x.target.value)}
                  required
                />
              </label>
              <label>
                {t("密码")}
                <input
                  type="password"
                  disabled={e.connectionStatus === "checking"}
                  value={conn.password}
                  autoComplete="new-password"
                  onChange={(x) => field("password", x.target.value)}
                  required
                />
              </label>
            </div>
            <p
              data-tone={e.connectionStatus === "ready" ? "success" : "warning"}
            >
              {t(
                {
                  unconfigured: "尚未配置",
                  checking: "正在检测连接",
                  ready: "连接可用",
                  failed: "连接不可用",
                }[e.connectionStatus],
              )}
              {e.connection && ` · ${e.connection.ip}:${e.connection.port}`}
            </p>
            <label>
              <input
                type="checkbox"
                checked={v.simulateFailure}
                onChange={(x) => onView({ simulateFailure: x.target.checked })}
              />{" "}
              {t("模拟连接失败")}
            </label>
            <div className={styles.actions}>
              <Button
                onClick={() =>
                  onView({
                    connectionDraft: {
                      ip: "192.0.2.10",
                      port: 443,
                      username: "migration-demo",
                      password: "sample-only",
                    },
                    simulateFailure: false,
                  })
                }
              >
                {t("填入示例配置")}
              </Button>
              <Button
                primary
                type="submit"
                disabled={
                  busy ||
                  e.connectionStatus === "checking" ||
                  (hasActiveControl(e) && e.connectionStatus === "ready")
                }
              >
                {t(
                  e.connectionStatus === "checking"
                    ? "正在检测"
                    : "检测并应用连接",
                )}
              </Button>
            </div>
            {hasActiveControl(e) && e.connectionStatus === "ready" && (
              <p className={styles.muted}>
                {t(
                  "运行中可以编辑草稿，请暂停同步或等待远程操作完成后再应用。",
                )}
              </p>
            )}
          </form>
        ) : v.tab === "issues" ? (
          <ExecutionIssues
            snapshot={s}
            view={v}
            onView={onView}
            busy={busy}
            onCommand={send}
            onUpload={onUpload}
            onDownload={onDownload}
          />
        ) : (
          <>
            {e.connectionStatus !== "ready" && (
              <p className={styles.notice}>
                {t("连接不可用，控制操作已暂停。请重新检测 Migration 连接。")}{" "}
                <Button onClick={() => onView({ tab: "connection" })}>
                  {t("连接配置")}
                </Button>
              </p>
            )}
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
            {!compact && (
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
                        (p, i) =>
                          `${(i * 600) / Math.max(1, e.trend.length - 1)},${65 - (p.speed / Math.max(1, ...e.trend.map((x) => x.speed))) * 55}`,
                      )
                      .join(" ")}
                  />
                </svg>
              </div>
            )}
            <div className={styles.toolbar}>
              <Select
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
                {s.planning?.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id}
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
                {Object.entries(phaseLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </Select>
              <input
                type="search"
                placeholder={t("搜索批次、虚拟机或业务系统")}
                value={v.query}
                disabled={locked}
                onChange={(x) => reset({ query: x.target.value })}
              />
            </div>
            <div className={styles.toolbar}>
              <span>{t("已选 {0} 台虚拟机", selected.length)}</span>
              <Button
                disabled={locked}
                onClick={() =>
                  toggle(
                    filtered.map((t) => t.id),
                    true,
                  )
                }
              >
                {t("选择全部筛选结果")}
              </Button>
              <Button
                disabled={locked}
                onClick={() => onView({ selected: [] })}
              >
                {t("清空选择")}
              </Button>
            </div>
            {e.preview ? (
              <ExecutionPreview
                preview={e.preview}
                conversationId={conversationId}
                busy={busy}
                onCommand={send}
              />
            ) : (
              <>
                <div className={styles.toolbar}>
                  {(
                    [
                      "start",
                      "increment",
                      "cutover",
                      "pause",
                      "resume",
                      "retry",
                    ] as const
                  ).map((action) => {
                    const reason = selected
                      .map((x) => executionBlock(s, x, action))
                      .find(Boolean);
                    return (
                      <Button
                        key={action}
                        primary={action === "start"}
                        disabled={locked || !selected.length || !!reason}
                        title={reason}
                        onClick={() => void preview(action)}
                      >
                        {t(actionLabels[action])}
                      </Button>
                    );
                  })}
                </div>
                <details>
                  <summary>{t("任务配置与批次调整")}</summary>
                  <div className={styles.form}>
                    <label>
                      {t("目标资源池")}
                      <input
                        disabled={locked}
                        value={v.computeResource}
                        onChange={(x) =>
                          onView({ computeResource: x.target.value })
                        }
                      />
                    </label>
                    <label>
                      {t("网络映射")}
                      <input
                        disabled={locked}
                        value={v.network}
                        onChange={(x) => onView({ network: x.target.value })}
                      />
                    </label>
                    <label>
                      {t("执行演示场景")}
                      <Select
                        value={v.scenario}
                        onValueChange={(scenario) =>
                          onView({
                            scenario: scenario as ExecutionView["scenario"],
                          })
                        }
                      >
                        <option value="normal">{t("正常执行")}</option>
                        <option value="network">{t("同步网络异常")}</option>
                        <option value="capacity">{t("目标容量不足")}</option>
                        <option value="permission">
                          {t("Migration 权限不足")}
                        </option>
                      </Select>
                    </label>
                    <p className={styles.muted}>
                      {t("异常场景仅作用于本次启动的首台虚拟机。")}
                    </p>
                    <label>
                      {t("移动到批次")}
                      <Select
                        value={v.targetBatchId}
                        disabled={locked}
                        onValueChange={(targetBatchId) =>
                          onView({ targetBatchId })
                        }
                      >
                        <option value="">{t("选择目标批次")}</option>
                        {s.planning?.batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.id}
                          </option>
                        ))}
                      </Select>
                      <Button
                        disabled={
                          locked ||
                          !selected.length ||
                          !v.targetBatchId ||
                          selected.some((x) => !!executionBlock(s, x, "move"))
                        }
                        onClick={() => void preview("move")}
                      >
                        {t("预览批次调整")}
                      </Button>
                    </label>
                    <label>
                      {t("后续割接窗口")}
                      <input
                        disabled={locked}
                        value={v.window}
                        onChange={(x) => onView({ window: x.target.value })}
                        placeholder={t("例如周六 22:00–24:00")}
                      />
                      <Button
                        disabled={
                          locked ||
                          !selected.length ||
                          !v.window ||
                          selected.some((x) => !!executionBlock(s, x, "window"))
                        }
                        onClick={() => void preview("window")}
                      >
                        {t("预览窗口调整")}
                      </Button>
                    </label>
                  </div>
                </details>
              </>
            )}
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={t("选择本页")}
                      disabled={locked}
                      checked={
                        pageIds.length > 0 &&
                        pageIds.every((id) => v.selected.includes(id))
                      }
                      onChange={(x) => toggle(pageIds, x.target.checked)}
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
                  const ids = row.tasks.map((x) => x.id),
                    done = row.tasks.filter(
                      (x) => x.phase === "validation",
                    ).length,
                    failed = row.tasks.filter(
                      (x) => x.phase === "failed",
                    ).length;
                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={t("选择 {0}", row.label)}
                            disabled={locked}
                            checked={ids.every((id) => v.selected.includes(id))}
                            ref={(el) => {
                              if (el)
                                el.indeterminate =
                                  ids.some((id) => v.selected.includes(id)) &&
                                  !ids.every((id) => v.selected.includes(id));
                            }}
                            onChange={(x) => toggle(ids, x.target.checked)}
                          />
                        </td>
                        <td
                          data-label={t(
                            v.mode === "batches" ? "批次" : "虚拟机",
                          )}
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
                                  style={{
                                    width: `${(done / ids.length) * 100}%`,
                                  }}
                                />
                                <span
                                  data-tone="danger"
                                  style={{
                                    width: `${(failed / ids.length) * 100}%`,
                                  }}
                                />
                                <span
                                  style={{
                                    width: `${(row.tasks.filter((x) => ["creating", "full", "incremental", "ready"].includes(x.phase)).length / ids.length) * 100}%`,
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
                          {[...new Set(row.tasks.map((x) => x.window))].join(
                            "；",
                          )}
                        </td>
                        <td>
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
                          {failed > 0 && (
                            <Button
                              onClick={() =>
                                onView({
                                  tab: "issues",
                                  issueId:
                                    e.issues.find(
                                      (i) =>
                                        i.taskIds.some((id) =>
                                          ids.includes(id),
                                        ) && i.state !== "resolved",
                                    )?.id ?? "",
                                })
                              }
                            >
                              {t("处理问题")}
                            </Button>
                          )}
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
              onChange={(x) => onView(x)}
              label={t("执行任务")}
              sizes={[20, 50, 100]}
              compact
              disabled={locked}
            />
          </>
        )}
      </div>
    </section>
  );
}
