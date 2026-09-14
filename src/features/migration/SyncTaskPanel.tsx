import type { BatchTask } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { useState } from "react";
export function SyncTaskPanel({
  batches,
  total,
  completed,
  onClose,
}: {
  batches: BatchTask[];
  total: number;
  completed: number;
  onClose: () => void;
}) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const rows = batches
    .flatMap((batch) =>
      batch.vmNames.map((vmName, index) => ({
        id: `${batch.id}-SYNC-${String(index + 1).padStart(2, "0")}`,
        batchId: batch.id,
        batchPhase: batch.batchPhase,
        vmName,
        source: `快照 S-${batch.id.slice(2)}-${String(index + 1).padStart(2, "0")}`,
        target: `10.88.${Number(batch.id.slice(2))}.${30 + index}`,
        window: `${batch.startDate} 20:00`,
        size: `${42 + index * 3} GB`,
      })),
    )
    .slice(0, total || 8);
  const visible = rows.filter((row) =>
    `${row.id}${row.batchId}${row.vmName}${row.target}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div
      className="panel-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="archive-panel task-panel sync-panel"
        role="region"
        aria-label={t("今日待增量同步任务")}
      >
        <header>
          <div>
            <p>TODAY&apos;S INCREMENTAL SYNC</p>
            <h2>{t("今日待增量同步任务")}</h2>
            <span>{t("查看每台虚拟机的同步窗口、源端快照与目标端信息")}</span>
          </div>
          <button onClick={onClose} aria-label={t("关闭")}>
            ×
          </button>
        </header>
        <div className="cutover-kpis">
          <div data-tone="info">
            <small>{t("同步任务")}</small>
            <strong>{t(rows.length)}</strong>
            <em>{t("来自迁移批次计划")}</em>
          </div>
          <div data-tone="success">
            <small>{t("已完成")}</small>
            <strong>{t(Math.min(completed, rows.length))}</strong>
            <em>{t("数据校验通过")}</em>
          </div>
          <div data-tone="brand">
            <small>{t("running")}</small>
            <strong>
              {t(completed < rows.length && completed > 0 ? 1 : 0)}
            </strong>
            <em>{t("持续同步变化块")}</em>
          </div>
          <div data-tone="info">
            <small>{t("待执行")}</small>
            <strong>{t(Math.max(0, rows.length - completed))}</strong>
            <em>{t("等待同步窗口")}</em>
          </div>
        </div>
        <div className="sync-toolbar">
          <p>{t("增量同步任务完成后，任务状态仍可在此查看。")}</p>
          <label>
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("查询任务编号、批次或虚拟机")}
            />
          </label>
        </div>
        <div className="sync-table-wrap">
          <table className="sync-table">
            <thead>
              <tr>
                <th>{t("任务编号")}</th>
                <th>{t("批次编号")}</th>
                <th>{t("批次阶段")}</th>
                <th>{t("虚拟机名称")}</th>
                <th>{t("源端快照")}</th>
                <th>{t("目标端 IP")}</th>
                <th>{t("同步数据量")}</th>
                <th>{t("计划窗口")}</th>
                <th>{t("任务状态")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((row, index) => {
                  const done = index < completed;
                  const running = !done && index === completed && completed > 0;
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{t(row.id)}</strong>
                      </td>
                      <td>{t(row.batchId)}</td>
                      <td>
                        <span className={`batch-phase phase-${row.batchPhase}`}>
                          {t(row.batchPhase)}
                        </span>
                      </td>
                      <td>{row.vmName}</td>
                      <td>{t(row.source)}</td>
                      <td>{t(row.target)}</td>
                      <td>{t(row.size)}</td>
                      <td>{t(row.window)}</td>
                      <td>
                        <span
                          className={`sync-status ${done ? "done" : running ? "running" : ""}`}
                        >
                          {t(done ? "已完成" : running ? "running" : "待执行")}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="empty-row">
                    {t("暂无符合条件的增量同步任务")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
