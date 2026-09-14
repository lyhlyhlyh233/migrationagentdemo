import type { VmTask } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { useState } from "react";
export function CutoverTaskPanel({
  tasks,
  completedIds,
  running,
  onComplete,
  onClose,
  onNotify,
}: {
  tasks: VmTask[];
  completedIds: string[];
  running: boolean;
  onComplete: (taskIds: string[]) => void;
  onClose: () => void;
  onNotify: (message: string) => void;
}) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const visibleTasks = tasks.filter(
    (task) =>
      (statusFilter === "全部" || task.status === statusFilter) &&
      `${task.name}${task.targetIp}${task.id}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selectableIds = tasks
    .filter((task) => !completedIds.includes(task.id))
    .map((task) => task.id);
  const actionableIds = selectedIds.filter((id) => selectableIds.includes(id));
  const statusCount = (status: string) =>
    status === "全部"
      ? tasks.length
      : tasks.filter((task) => task.status === status).length;

  return (
    <div
      className="panel-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="archive-panel task-panel cutover-panel"
        role="region"
        aria-label={t("今日待割接任务")}
      >
        <header>
          <div>
            <p>TODAY&apos;S CUTOVER QUEUE</p>
            <h2>{t("今日待割接任务")}</h2>
            <span>{t("任务详情与任务管理中的单虚拟机执行记录保持一致")}</span>
          </div>
          <button onClick={onClose} aria-label={t("关闭")}>
            ×
          </button>
        </header>
        <div className="cutover-kpis">
          <div data-tone="info">
            <small>{t("待割接任务")}</small>
            <strong>{t(tasks.length)}</strong>
            <em>{t("来自今日割接验证批次")}</em>
          </div>
          <div data-tone="success">
            <small>{t("同步已完成")}</small>
            <strong>
              {t(tasks.filter((task) => task.status === "succeeded").length)}
            </strong>
            <em>{t("可进入割接前检查")}</em>
          </div>
          <div data-tone="brand">
            <small>{t("同步处理中")}</small>
            <strong>
              {t(tasks.filter((task) => task.status === "syncing").length)}
            </strong>
            <em>{t("持续监控数据状态")}</em>
          </div>
          <div data-tone="brand">
            <small>{t("已选择")}</small>
            <strong>{t(selectedIds.length)}</strong>
            <em>{t("支持批量发起割接")}</em>
          </div>
        </div>
        <div className="vm-task-tabs">
          {["全部", "succeeded", "pending-sync", "syncing", "paused"].map(
            (status) => (
              <button
                key={status}
                className={statusFilter === status ? "active" : ""}
                onClick={() => setStatusFilter(status)}
              >
                {t(status)} <b>{t(statusCount(status))}</b>
              </button>
            ),
          )}
        </div>
        <p className="shared-task-note" role="status">
          {t(
            running
              ? "割接队列正在执行，所有会话共享此状态。"
              : `已完成 ${completedIds.length} / ${tasks.length} 个割接任务。`,
          )}
        </p>
        <div className="vm-task-toolbar">
          <div>
            <button
              disabled={running || !actionableIds.length}
              onClick={() =>
                onNotify(`已对 ${selectedIds.length} 个任务发起割接前检查`)
              }
            >
              {t("✓ 割接前检查")}
            </button>
            <button
              className="complete-cutover"
              disabled={running || !actionableIds.length}
              onClick={() => {
                onComplete(actionableIds);
                setSelectedIds([]);
              }}
            >
              {t("✓ 确认割接完成")}
            </button>
            <button onClick={() => onNotify("待割接任务报告已导出（演示）")}>
              {t("⇩ 导出报告")}
            </button>
          </div>
          <label>
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("输入任务名称、目标 IP 或任务编号")}
            />
          </label>
          <button
            onClick={() => {
              setQuery("");
              setStatusFilter("全部");
            }}
          >
            ↻
          </button>
        </div>
        <div className="vm-table-wrap">
          <table className="vm-task-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    disabled={running || !selectableIds.length}
                    checked={
                      selectableIds.length > 0 &&
                      selectableIds.every((id) => selectedIds.includes(id))
                    }
                    onChange={(event) =>
                      setSelectedIds(event.target.checked ? selectableIds : [])
                    }
                    aria-label={t("选择全部待割接任务")}
                  />
                </th>
                <th>{t("任务名称")}</th>
                <th>{t("迁移目标 IP")}</th>
                <th>{t("任务状态")}</th>
                <th>{t("校验状态")}</th>
                <th>{t("任务进度")}</th>
                <th>{t("当前已迁移/总量")}</th>
                <th>{t("迁移速率")}</th>
                <th>{t("开始时间")}</th>
                <th>{t("结束时间")}</th>
                <th>{t("耗时")}</th>
                <th>{t("剩余迁移时间")}</th>
                <th>{t("操作")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <input
                        type="checkbox"
                        disabled={running || completedIds.includes(task.id)}
                        checked={selectedIds.includes(task.id)}
                        onChange={(event) =>
                          setSelectedIds((ids) =>
                            event.target.checked
                              ? [...ids, task.id]
                              : ids.filter((id) => id !== task.id),
                          )
                        }
                        aria-label={t(`选择 ${task.name}`)}
                      />
                    </td>
                    <td>
                      <strong>{task.name}</strong>
                      <small>{t(task.id)}</small>
                    </td>
                    <td>{t(task.targetIp)}</td>
                    <td>
                      <span className={`vm-status status-${task.status}`}>
                        {t(
                          completedIds.includes(task.id)
                            ? "割接完成"
                            : running
                              ? "割接执行中"
                              : task.status,
                        )}
                      </span>
                    </td>
                    <td>{t(task.checkStatus)}</td>
                    <td>
                      <div className="vm-progress">
                        <span>
                          <i style={{ width: `${task.progress}%` }} />
                        </span>
                        <b>{t(task.progress)}%</b>
                      </div>
                    </td>
                    <td>{t(task.migrated)}</td>
                    <td>{t(task.speed)}</td>
                    <td>{t(task.startTime)}</td>
                    <td>{t(task.endTime)}</td>
                    <td>{t(task.duration)}</td>
                    <td>{t(task.remaining)}</td>
                    <td>
                      <button
                        className="vm-more"
                        onClick={() =>
                          onNotify(`${task.name} 割接任务详情已打开`)
                        }
                      >
                        {t("详情 ···")}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="empty-row" colSpan={13}>
                    {t("暂无符合条件的待割接任务")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="vm-table-foot">
          <span>
            {t(
              `总条数：${visibleTasks.length} · 今日割接窗口 22:00–次日 02:00`,
            )}
          </span>
          <div>
            <button>{t("10 / 页⌄")}</button>
            <button>‹</button>
            <b>1</b>
            <button>›</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
