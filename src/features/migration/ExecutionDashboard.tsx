import { Fragment, useEffect, useRef } from "react";
import type { ExecutionState } from "@/domain/execution";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow } from "@/shared/ui/pagination-state";
import { Select } from "@/shared/ui/Select";
import {
  batchProgressGroups,
  executionDashboard,
  taskExecutionStage,
  taskExecutionStatus,
} from "./execution-dashboard";
import styles from "./ExecutionDashboard.module.css";

export function ExecutionDashboard({
  execution: e,
  demoTools = false,
  selectedBatchId,
  expandedTaskId,
  onBatch,
  taskPage = 1,
  taskSize = 10,
  onPage,
  onTask,
  onIssue,
  onDownload,
}: {
  execution: ExecutionState;
  demoTools?: boolean;
  selectedBatchId?: string;
  expandedTaskId?: string;
  onBatch: (id: string) => void;
  taskPage?: number;
  taskSize?: number;
  onPage: (value: { page: number; size: number }) => void;
  onTask?: (id: string) => void;
  onIssue?: (id: string) => void;
  onDownload?: (id: string) => void;
}) {
  const t = useTranslation(),
    data = executionDashboard(e);
  const batchId = data.batches.some((batch) => batch.id === selectedBatchId)
    ? selectedBatchId!
    : (data.batches.find((batch) => batch.id === e.recommendedBatchId)?.id ??
      data.batches[0]?.id);
  const tasks = e.tasks.filter((task) => task.batchId === batchId);
  const selectedData = executionDashboard({ ...e, tasks });
  const range = pageWindow(tasks.length, { page: taskPage, size: taskSize });
  const expandedRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    expandedRow.current?.scrollIntoView({ block: "nearest" });
  }, [expandedTaskId, range.page]);
  const time = (value: number) =>
    new Date(value).toLocaleTimeString([], { hour12: false });
  return (
    <section className={styles.root} aria-label={t("任务看板")}>
      <div className={styles.heading}>
        <h3>
          {t("整体批次进度")}
          {demoTools && e.sampleProgress && (
            <span className={styles.sample}>{t("示例进度")}</span>
          )}
        </h3>
        <span>
          {t("{0} 个批次 · {1} 台虚拟机", data.batches.length, e.tasks.length)}
        </span>
      </div>
      <div
        className={styles.batchChart}
        role="group"
        aria-label={t("批次任务状态分布")}
      >
        <div className={styles.chartHead}>
          <span>{t("批次")}</span>
          <span className={styles.axis}>
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </span>
          <span>{t("已割接")}</span>
        </div>
        {data.batches.map((batch) => (
          <button
            className={styles.batchRow}
            key={batch.id}
            aria-pressed={batchId === batch.id}
            aria-label={`${t(
              "选择批次 {0}，{1} 台虚拟机，已割接 {2} 台",
              batch.id,
              batch.total,
              batch.complete,
            )}; ${batch.segments.map((segment) => `${t(segment.label)} ${segment.count}`).join(", ")}`}
            onClick={() => onBatch(batch.id)}
          >
            <strong>{batch.id}</strong>
            <span className={styles.batchTrack} aria-hidden="true">
              {batch.segments
                .filter((segment) => segment.count > 0)
                .map((segment) => (
                  <span
                    key={segment.id}
                    className={styles.segment}
                    data-tone={segment.tone}
                    style={{ width: `${(segment.count / batch.total) * 100}%` }}
                    title={t(
                      "{0}：{1} 台（{2}%）",
                      t(segment.label),
                      segment.count,
                      Math.round((segment.count / batch.total) * 100),
                    )}
                  >
                    {segment.count / batch.total >= 0.12 ? segment.count : ""}
                  </span>
                ))}
            </span>
            <span className={styles.batchTotal}>
              {batch.complete}
              <small>/{batch.total}</small>
            </span>
          </button>
        ))}
        <div className={styles.legend}>
          {batchProgressGroups.map((group) => (
            <span key={group.id}>
              <i data-tone={group.tone} />
              {t(group.label)}
            </span>
          ))}
        </div>
        {!data.batches.length && (
          <p className={styles.note}>{t("暂无迁移批次")}</p>
        )}
      </div>
      <div className={styles.section}>
        <div className={styles.heading}>
          <h3>{t("任务统计")}</h3>
          <Select
            className={styles.batchSelect}
            aria-label={t("选择批次")}
            value={batchId ?? ""}
            disabled={!data.batches.length}
            onValueChange={onBatch}
          >
            {data.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {t("{0} · {1} 台虚拟机", batch.id, batch.total)}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.distribution} aria-hidden="true">
          {selectedData.distribution
            .filter((group) => group.count)
            .map((group) => (
              <span
                key={group.id}
                data-tone={group.tone}
                style={{
                  width: `${(group.count / Math.max(tasks.length, 1)) * 100}%`,
                }}
              />
            ))}
        </div>
        <dl className={styles.states}>
          {selectedData.distribution.map((group) => (
            <div key={group.id}>
              <dt>
                <i data-tone={group.tone} />
                {t(group.label)}
              </dt>
              <dd data-tone={group.tone}>{group.count}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={styles.section}>
        <div className={styles.heading}>
          <h3>{t("本批次任务")}</h3>
          <span>
            {data.latest ? t("更新于 {0}", time(data.latest)) : t("尚未启动")}
          </span>
        </div>
        <table className={styles.tasks}>
          <colgroup>
            <col />
            <col className={styles.stageCol} />
            <col className={styles.stateCol} />
            <col className={styles.progressCol} />
            <col className={styles.rateCol} />
          </colgroup>
          <thead>
            <tr>
              <th>{t("虚拟机")}</th>
              <th>{t("阶段")}</th>
              <th>{t("状态")}</th>
              <th>{t("同步进度")}</th>
              <th>{t("速率")}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.slice(range.start, range.end).map((task) => {
              const issue = e.issues.find(
                (item) =>
                  item.taskIds.includes(task.id) && item.state !== "resolved",
              );
              const validation = e.validations.find(
                (record) => record.taskId === task.id,
              );
              const tone =
                task.phase === "failed" || validation?.business === "failed"
                  ? "danger"
                  : task.phase === "validation"
                    ? "success"
                    : ["paused", "ready", "created", "full-complete"].includes(
                          task.phase,
                        )
                      ? "warning"
                      : "info";
              const expanded = expandedTaskId === task.id;
              const status =
                task.phase === "validation"
                  ? validation?.business === "passed"
                    ? "业务通过"
                    : validation?.business === "failed"
                      ? "业务不通过"
                      : "待业务验证"
                  : taskExecutionStatus(task);
              return (
                <Fragment key={task.id}>
                  <tr
                    ref={expanded ? expandedRow : undefined}
                    data-selected={expanded || undefined}
                  >
                    <td>
                      <button
                        className={styles.taskName}
                        onClick={() => onTask?.(task.id)}
                        title={task.assetId}
                        aria-expanded={expanded}
                        aria-controls={`task-detail-${task.id}`}
                      >
                        {task.name}
                      </button>
                    </td>
                    <td>{t(taskExecutionStage(task))}</td>
                    <td data-tone={tone}>
                      {issue ? (
                        <button
                          className={styles.issueLink}
                          onClick={() => onIssue?.(issue.id)}
                        >
                          {t(status)} ↗
                        </button>
                      ) : (
                        t(status)
                      )}
                    </td>
                    <td>
                      <div className={styles.taskProgress}>
                        <span>
                          <i style={{ width: `${task.progress}%` }} />
                        </span>
                        <b>{task.progress}%</b>
                      </div>
                    </td>
                    <td className={styles.rate}>
                      {task.speed} <small>MB/s</small>
                    </td>
                  </tr>
                  {expanded && (
                    <tr
                      className={styles.detailRow}
                      id={`task-detail-${task.id}`}
                    >
                      <td colSpan={5}>
                        <dl className={styles.details}>
                          <dt>{t("虚拟机标识")}</dt>
                          <dd>{task.assetId}</dd>
                          <dt>{t("目标资源池 / 网络映射")}</dt>
                          <dd>
                            {task.computeResource} / {task.network}
                          </dd>
                          <dt>{t("割接窗口")}</dt>
                          <dd>{task.window || "—"}</dd>
                          <dt>{t("已同步 / 总量")}</dt>
                          <dd>
                            {Math.round(task.syncedGB)} / {task.totalGB} GB
                          </dd>
                          <dt>{t("最近增量同步")}</dt>
                          <dd>
                            {task.lastSync
                              ? new Date(task.lastSync).toLocaleTimeString()
                              : t("尚未同步")}
                          </dd>
                          {issue && (
                            <>
                              <dt>{t("诊断日志")}</dt>
                              <dd className={styles.detailActions}>
                                <Button onClick={() => onIssue?.(issue.id)}>
                                  {t("查看诊断")}
                                  <Icon name="right" size={14} />
                                </Button>
                                {issue.logId && onDownload && (
                                  <Button
                                    onClick={() => onDownload(issue.logId!)}
                                  >
                                    <Icon name="download" size={14} />
                                    {t(demoTools ? "下载模拟日志" : "下载日志")}
                                  </Button>
                                )}
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
        {!tasks.length && (
          <p className={styles.note}>{t("暂无符合条件的任务")}</p>
        )}
        <Pagination
          total={tasks.length}
          value={{ page: taskPage, size: taskSize }}
          onChange={onPage}
          label={t("本批次任务")}
          sizes={[10, 20, 50]}
          compact
        />
      </div>
      <p className={styles.note}>
        {t("任务操作在对话中确认；割接完成后仍需业务验证。")}
      </p>
    </section>
  );
}
