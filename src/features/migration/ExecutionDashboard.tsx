import type { ExecutionState } from "@/domain/execution";
import { phaseLabels } from "@/domain/execution";
import { useTranslation } from "@/shared/i18n";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow } from "@/shared/ui/pagination-state";
import { executionDashboard } from "./execution-dashboard";
import styles from "./ExecutionDashboard.module.css";

export function ExecutionDashboard({
  execution: e,
  selectedBatchId,
  onBatch,
  taskPage = 1,
  taskSize = 10,
  onPage,
  onTask,
  onIssue,
}: {
  execution: ExecutionState;
  selectedBatchId?: string;
  onBatch: (id: string) => void;
  taskPage?: number;
  taskSize?: number;
  onPage: (value: { page: number; size: number }) => void;
  onTask?: (id: string) => void;
  onIssue?: (id: string) => void;
}) {
  const t = useTranslation(),
    data = executionDashboard(e);
  const batchId = data.batches.some((batch) => batch.id === selectedBatchId)
    ? selectedBatchId!
    : data.batches[0]?.id;
  const tasks = e.tasks.filter((task) => task.batchId === batchId);
  const selectedData = executionDashboard({ ...e, tasks });
  const range = pageWindow(tasks.length, { page: taskPage, size: taskSize });
  const span = Math.max(1000, (data.latest ?? 0) - (data.start ?? 0));
  const time = (value: number) =>
    new Date(value).toLocaleTimeString([], { hour12: false });
  return (
    <section className={styles.root} aria-label={t("任务看板")}>
      <div className={styles.heading}>
        <h3>{t("整体批次进度")}</h3>
        <span>
          {t("{0} 个批次 · {1} 台虚拟机", data.batches.length, e.tasks.length)}
        </span>
      </div>
      <div className={styles.timeline}>
        <div className={styles.timelineHead}>
          <span>{t("批次")}</span>
          <span>{t("已创建")}</span>
          <span>{t("已割接")}</span>
          <span className={styles.axis}>
            {data.start === undefined ? (
              t("实际执行进度")
            ) : (
              <>
                <span>{time(data.start)}</span>
                <span>{time(data.latest!)}</span>
              </>
            )}
          </span>
        </div>
        {data.batches.map((batch) => (
          <button
            className={styles.batchRow}
            key={batch.id}
            aria-pressed={batchId === batch.id}
            onClick={() => onBatch(batch.id)}
          >
            <strong>{batch.id}</strong>
            <span>
              {batch.created}/{batch.total}
            </span>
            <span>
              {batch.complete}/{batch.total}
            </span>
            <span className={styles.track}>
              {batch.start !== undefined && (
                <span
                  className={styles.bar}
                  data-tone={batch.tone}
                  style={{
                    left: `${((batch.start - (data.start ?? batch.start)) / span) * 100}%`,
                    width: `${Math.max(1, (((batch.end ?? batch.start) - batch.start) / span) * 100)}%`,
                  }}
                />
              )}
              <span className={styles.status} data-tone={batch.tone}>
                {t(batch.label)}
                {batch.failed ? ` · ${batch.failed}` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className={styles.section}>
        <div className={styles.heading}>
          <h3>
            {batchId} · {t("任务统计")}
          </h3>
          <span>{t("选择批次查看详情")}</span>
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
            <col className={styles.stateCol} />
            <col className={styles.progressCol} />
            <col className={styles.rateCol} />
          </colgroup>
          <thead>
            <tr>
              <th>{t("虚拟机")}</th>
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
              const tone =
                task.phase === "failed"
                  ? "danger"
                  : task.phase === "validation"
                    ? "success"
                    : ["paused", "ready", "created", "full-complete"].includes(
                          task.phase,
                        )
                      ? "warning"
                      : "info";
              return (
                <tr key={task.id}>
                  <td>
                    <button
                      className={styles.taskName}
                      onClick={() => onTask?.(task.id)}
                      title={task.assetId}
                    >
                      {task.name}
                    </button>
                  </td>
                  <td data-tone={tone}>
                    {issue ? (
                      <button
                        className={styles.issueLink}
                        onClick={() => onIssue?.(issue.id)}
                      >
                        {t(phaseLabels[task.phase])} ↗
                      </button>
                    ) : (
                      t(phaseLabels[task.phase])
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
              );
            })}
          </tbody>
        </table>
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
