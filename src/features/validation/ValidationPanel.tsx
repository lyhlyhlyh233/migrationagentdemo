import type { ValidationVm } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { useState } from "react";
export function ValidationPanel({
  tasks,
  completedBatchIds,
  onConfirm,
  onConfirmBatch,
  onClose,
}: {
  tasks: ValidationVm[];
  completedBatchIds: string[];
  onConfirm: (id: string) => void;
  onConfirmBatch: (ids: string[]) => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  const [selectedTask, setSelectedTask] = useState<ValidationVm | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "全部" | "待确认" | "迁移完成"
  >("全部");
  const visibleTasks = tasks.filter(
    (task) =>
      (statusFilter === "全部" ||
        (statusFilter === "迁移完成" ? task.confirmed : !task.confirmed)) &&
      `${task.batchId}${task.batchPhase}${t(task.batchPhase)}${task.vmName}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const confirmedCount = tasks.filter((task) => task.confirmed).length;
  const selectableVisibleIds = visibleTasks
    .filter((task) => !task.confirmed && task.comparison === "matched")
    .map((task) => task.id);
  const selectedConfirmableIds = selectedIds.filter((id) =>
    tasks.some(
      (task) =>
        task.id === id && !task.confirmed && task.comparison === "matched",
    ),
  );
  function confirmSelected() {
    onConfirmBatch(selectedConfirmableIds);
    setSelectedIds([]);
  }
  const comparisonGroups = selectedTask
    ? [
        {
          title: "CPU",
          icon: "CPU",
          rows: [
            [
              "虚拟机总核数",
              selectedTask.source.cpu.totalCores,
              selectedTask.target.cpu.totalCores,
            ],
            [
              "CPU 预留值",
              selectedTask.source.cpu.reservation,
              selectedTask.target.cpu.reservation,
            ],
            [
              "CPU 资源份额",
              selectedTask.source.cpu.shares,
              selectedTask.target.cpu.shares,
            ],
            [
              "CPU 上限",
              selectedTask.source.cpu.limit,
              selectedTask.target.cpu.limit,
            ],
            [
              "CPU 热插拔",
              selectedTask.source.cpu.hotPlug,
              selectedTask.target.cpu.hotPlug,
            ],
          ],
        },
        {
          title: "内存",
          icon: "MEM",
          rows: [
            [
              "内存总大小",
              selectedTask.source.memory.totalSize,
              selectedTask.target.memory.totalSize,
            ],
            [
              "内存预留值",
              selectedTask.source.memory.reservation,
              selectedTask.target.memory.reservation,
            ],
            [
              "内存资源份额",
              selectedTask.source.memory.shares,
              selectedTask.target.memory.shares,
            ],
            [
              "内存热插拔",
              selectedTask.source.memory.hotPlug,
              selectedTask.target.memory.hotPlug,
            ],
          ],
        },
        {
          title: "磁盘",
          icon: "DSK",
          rows: [
            [
              "磁盘总线类型",
              selectedTask.source.disk.busType,
              selectedTask.target.disk.busType,
            ],
            [
              "槽位编号",
              selectedTask.source.disk.slot,
              selectedTask.target.disk.slot,
            ],
            [
              "磁盘大小",
              selectedTask.source.disk.size,
              selectedTask.target.disk.size,
            ],
            [
              "磁盘类型",
              selectedTask.source.disk.type,
              selectedTask.target.disk.type,
            ],
          ],
        },
        {
          title: "网络",
          icon: "NET",
          rows: [
            [
              "IP",
              selectedTask.source.network.ip,
              selectedTask.target.network.ip,
            ],
            [
              "MAC",
              selectedTask.source.network.mac,
              selectedTask.target.network.mac,
            ],
            [
              "网卡总线编号",
              selectedTask.source.network.busNumber,
              selectedTask.target.network.busNumber,
            ],
            [
              "路由",
              selectedTask.source.network.route,
              selectedTask.target.network.route,
            ],
            [
              "网卡 IO 环大小",
              selectedTask.source.network.ioRing,
              selectedTask.target.network.ioRing,
            ],
            [
              "网卡队列数",
              selectedTask.source.network.queues,
              selectedTask.target.network.queues,
            ],
            [
              "网卡 Poll 加速值",
              selectedTask.source.network.pollAcceleration,
              selectedTask.target.network.pollAcceleration,
            ],
            [
              "DNS",
              selectedTask.source.network.dns,
              selectedTask.target.network.dns,
            ],
            [
              "网关",
              selectedTask.source.network.gateway,
              selectedTask.target.network.gateway,
            ],
            [
              "TCP/IP 协议栈配置",
              selectedTask.source.network.tcpIpStack,
              selectedTask.target.network.tcpIpStack,
            ],
          ],
        },
        {
          title: "显卡",
          icon: "GPU",
          rows: [
            [
              "类型",
              selectedTask.source.display.type,
              selectedTask.target.display.type,
            ],
            [
              "显存大小",
              selectedTask.source.display.memory,
              selectedTask.target.display.memory,
            ],
          ],
        },
      ]
    : [];

  if (selectedTask)
    return (
      <div className="panel-backdrop">
        <aside
          className="archive-panel validation-panel validation-detail"
          role="region"
          aria-label={t(`${selectedTask.vmName} 验证结果详情`)}
        >
          <header>
            <div>
              <p>VM VALIDATION RESULT</p>
              <h2>{t("虚拟机配置对比结果")}</h2>
              <span>
                {t(selectedTask.batchId)} · {t(selectedTask.vmName)}
              </span>
            </div>
            <div className="validation-head-actions">
              <button onClick={() => setSelectedTask(null)}>
                {t("← 返回列表")}
              </button>
              <button onClick={onClose} aria-label={t("关闭")}>
                ×
              </button>
            </div>
          </header>
          <div className="validation-identity">
            <div>
              <small>{t("虚拟机名称")}</small>
              <strong>{t(selectedTask.vmName)}</strong>
            </div>
            <div>
              <small>{t("虚拟机 UUID")}</small>
              <strong>{t(selectedTask.uuid)}</strong>
            </div>
            <div>
              <small>{t("操作系统类型")}</small>
              <strong>{t(selectedTask.osType)}</strong>
            </div>
            <div>
              <small>{t("总体对比结果")}</small>
              <strong className="validation-match">
                ✓ {t(selectedTask.comparison)}
              </strong>
            </div>
          </div>
          <div className="comparison-column-head">
            <span>{t("配置项")}</span>
            <b>{t("源端配置")}</b>
            <b>{t("目标端配置")}</b>
            <em>{t("结果")}</em>
          </div>
          <div className="comparison-groups">
            {comparisonGroups.map((group) => (
              <section key={group.title} className="comparison-group">
                <header>
                  <span>{t(group.icon)}</span>
                  <h3>{t(group.title)}</h3>
                  <em>{t(`${group.rows.length} 项一致`)}</em>
                </header>
                <div>
                  {group.rows.map(([label, source, target]) => (
                    <div className="comparison-row" key={label}>
                      <span>{t(label)}</span>
                      <b>{t(source)}</b>
                      <b>{t(target)}</b>
                      <em>{t("✓ 一致")}</em>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="validation-approval">
            <span className={selectedTask.confirmed ? "approved" : ""}>
              {t(selectedTask.confirmed ? "✓" : "!")}
            </span>
            <div>
              <strong>
                {t(
                  selectedTask.confirmed
                    ? "该虚拟机已人工确认迁移完成"
                    : "请完成最终人工验收",
                )}
              </strong>
              <p>
                {t(
                  selectedTask.confirmed
                    ? "确认记录已写入验证时间线，并同步更新批次状态。"
                    : "确认源端与目标端配置对比无问题后，点击“人工确认 OK”。",
                )}
              </p>
            </div>
            <button
              disabled={
                selectedTask.confirmed || selectedTask.comparison !== "matched"
              }
              onClick={() => {
                onConfirm(selectedTask.id);
                setSelectedTask({ ...selectedTask, confirmed: true });
              }}
            >
              {t(selectedTask.confirmed ? "已确认 OK" : "人工确认 OK")}
            </button>
          </div>
        </aside>
      </div>
    );

  return (
    <div
      className="panel-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="archive-panel validation-panel"
        role="region"
        aria-label={t("今日虚拟机验证列表")}
      >
        <header>
          <div>
            <p>RESULT VALIDATION WORKSPACE</p>
            <h2>{t("今日虚拟机验证列表")}</h2>
            <span>{t("源端与目标端配置自动对比，人工确认后完成迁移")}</span>
          </div>
          <button onClick={onClose} aria-label={t("关闭")}>
            ×
          </button>
        </header>
        <div className="validation-kpis">
          <div data-tone="info">
            <small>{t("今日进入验证")}</small>
            <strong>{t(tasks.length)}</strong>
            <em>{t("已完成割接的虚拟机")}</em>
          </div>
          <div data-tone="success">
            <small>{t("Agent 对比一致")}</small>
            <strong>
              {t(tasks.filter((task) => task.comparison === "matched").length)}
            </strong>
            <em>{t("配置自动验证通过")}</em>
          </div>
          <div data-tone="success">
            <small>{t("人工已确认")}</small>
            <strong>{t(confirmedCount)}</strong>
            <em>{t(`${tasks.length - confirmedCount} 台待确认`)}</em>
          </div>
          <div data-tone="success">
            <small>{t("迁移完成批次")}</small>
            <strong>{t(completedBatchIds.length)}</strong>
            <em>{t("全批次验证完成")}</em>
          </div>
        </div>
        <div className="validation-toolbar">
          <div>
            {(["全部", "待确认", "迁移完成"] as const).map((status) => (
              <button
                key={status}
                className={statusFilter === status ? "active" : ""}
                onClick={() => setStatusFilter(status)}
              >
                {t(status)}{" "}
                <b>
                  {t(
                    status === "全部"
                      ? tasks.length
                      : status === "迁移完成"
                        ? confirmedCount
                        : tasks.length - confirmedCount,
                  )}
                </b>
              </button>
            ))}
            <button
              className="validation-bulk-confirm"
              disabled={!selectedConfirmableIds.length}
              onClick={confirmSelected}
            >
              {t(
                `✓ 批量确认 OK${selectedConfirmableIds.length ? `(${selectedConfirmableIds.length})` : ""}`,
              )}
            </button>
          </div>
          <label>
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("查询批次编号、阶段或虚拟机名称")}
            />
          </label>
        </div>
        <div className="validation-table-wrap">
          <table className="validation-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label={t("选择全部待确认虚拟机")}
                    checked={
                      selectableVisibleIds.length > 0 &&
                      selectableVisibleIds.every((id) =>
                        selectedIds.includes(id),
                      )
                    }
                    onChange={(event) =>
                      setSelectedIds(
                        event.target.checked
                          ? Array.from(
                              new Set([
                                ...selectedIds,
                                ...selectableVisibleIds,
                              ]),
                            )
                          : selectedIds.filter(
                              (id) => !selectableVisibleIds.includes(id),
                            ),
                      )
                    }
                  />
                </th>
                <th>{t("批次编号")}</th>
                <th>{t("批次阶段")}</th>
                <th>{t("虚拟机名称")}</th>
                <th>{t("源端配置")}</th>
                <th>{t("目标端配置")}</th>
                <th>{t("验证结果对比")}</th>
                <th>{t("验收状态")}</th>
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
                        aria-label={t(`选择 ${task.vmName}`)}
                        disabled={
                          task.confirmed || task.comparison !== "matched"
                        }
                        checked={selectedIds.includes(task.id)}
                        onChange={(event) =>
                          setSelectedIds((ids) =>
                            event.target.checked
                              ? [...ids, task.id]
                              : ids.filter((id) => id !== task.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <strong>{t(task.batchId)}</strong>
                    </td>
                    <td>
                      <span className={`batch-phase phase-${task.batchPhase}`}>
                        {t(task.batchPhase)}
                      </span>
                    </td>
                    <td>
                      <strong>{task.vmName}</strong>
                      <small>{t(task.osType)}</small>
                    </td>
                    <td>
                      <span className="config-summary">
                        {t(task.source.cpu.totalCores)} ·{" "}
                        {t(task.source.memory.totalSize)}
                        <small>
                          {t(task.source.disk.size)} ·{" "}
                          {t(task.source.network.ip)}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className="config-summary">
                        {t(task.target.cpu.totalCores)} ·{" "}
                        {t(task.target.memory.totalSize)}
                        <small>
                          {t(task.target.disk.size)} ·{" "}
                          {t(task.target.network.ip)}
                        </small>
                      </span>
                    </td>
                    <td>
                      <button
                        className="comparison-link"
                        onClick={() => setSelectedTask(task)}
                      >
                        <span>✓ {t(task.comparison)}</span>
                        <small>{t("查看结果信息 →")}</small>
                      </button>
                    </td>
                    <td>
                      <span
                        className={
                          task.confirmed
                            ? "validation-status confirmed"
                            : "validation-status"
                        }
                      >
                        {t(task.confirmed ? "迁移完成" : "待人工确认")}
                      </span>
                    </td>
                    <td>
                      <button
                        className="validation-single-confirm"
                        disabled={
                          task.confirmed || task.comparison !== "matched"
                        }
                        onClick={() => {
                          onConfirm(task.id);
                          setSelectedIds((ids) =>
                            ids.filter((id) => id !== task.id),
                          );
                        }}
                      >
                        {t(task.confirmed ? "confirmed" : "确认 OK")}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="empty-row">
                    {t("暂无符合条件的验证任务")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="validation-foot">
          <span>{t(`共${visibleTasks.length} 条 · 示例配置对比完成`)}</span>
          <p>{t("批次内全部虚拟机人工确认后，批次自动更新为“迁移完成”")}</p>
        </div>
      </aside>
    </div>
  );
}
