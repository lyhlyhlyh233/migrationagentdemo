import { migrationMethodLabels } from "@/shared/i18n/risks";
import type {
  BatchTask,
  CreationTask,
  RiskItem,
  VmTask,
} from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { stageName } from "@/shared/i18n/stages";
import { Select } from "@/shared/ui/Select";
import { Status } from "@/shared/ui/Status";
import { useState } from "react";
export function TaskPanel({
  projectId,
  batches,
  vmTaskData,
  creationTasks,
  risks,
  completedBatchIds,
  projectExists,
  onClose,
  onNotify,
  onAction,
}: {
  projectId: string;
  batches: BatchTask[];
  vmTaskData: VmTask[];
  creationTasks: CreationTask[];
  risks: RiskItem[];
  completedBatchIds: string[];
  projectExists: boolean;
  onClose: () => void;
  onAction: (action: string, ids: string[]) => void;
  onNotify: (message: string) => void;
}) {
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<"batches" | "tasks">("batches");
  const [selectedBatch, setSelectedBatch] = useState<BatchTask | null>(null);
  const [selectedVmId, setSelectedVmId] = useState<string | null>(null);
  const selectedVm = vmTaskData.find((v) => v.id === selectedVmId) ?? null;
  const setSelectedVm = (vm: VmTask | null) => setSelectedVmId(vm?.id ?? null);
  const [selectedVmIds, setSelectedVmIds] = useState<string[]>([]);
  const [batchPhaseFilter, setBatchPhaseFilter] = useState<
    "全部" | BatchTask["batchPhase"]
  >("全部");
  const [showGantt, setShowGantt] = useState(false);
  const [selectedGanttBatchId, setSelectedGanttBatchId] = useState<
    string | null
  >(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "全部" | "created" | "未创建"
  >("全部");
  const totalVms = new Set(batches.flatMap((batch) => batch.vmNames)).size;
  const visibleBatches =
    batchPhaseFilter === "全部"
      ? batches
      : batches.filter((batch) => batch.batchPhase === batchPhaseFilter);
  const ganttDays = Array.from({ length: 17 }, (_, index) => 7 + index);
  const activeBatch = selectedBatch ?? batches[0] ?? null;
  const vmTasks = vmTaskData.filter((v) => v.batchId === activeBatch?.id);
  const creationByVm = new Map(
    creationTasks.map((task) => [task.sourceTaskId, task]),
  );
  const isCreated = (taskId: string) =>
    creationByVm.get(taskId)?.status === "created";
  const visibleVmTasks = vmTasks.filter(
    (task) =>
      (statusFilter === "全部" ||
        (statusFilter === "created"
          ? isCreated(task.id)
          : !isCreated(task.id))) &&
      `${task.name}${task.id}${task.targetIp}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const createdCount = vmTasks.filter((task) => isCreated(task.id)).length;
  const selectedCreation = selectedVm
    ? creationByVm.get(selectedVm.id)
    : undefined;
  const selectedVmRisks = selectedVm
    ? risks.filter(
        (risk) => !risk.closed && selectedVm.riskIds.includes(risk.id),
      )
    : [];
  const selectedVmOs = selectedCreation?.os ?? selectedVm?.os ?? "—";
  const migrationTaskRows = selectedVm
    ? [
        [
          selectedVm.id,
          t(activeBatch?.stageType ?? "任务"),
          t(selectedVm.status),
          `${selectedVm.progress}%`,
          selectedVm.startTime,
          selectedVm.endTime,
        ],
      ]
    : [];

  function openTaskTab(batch?: BatchTask) {
    setSelectedBatch(batch ?? selectedBatch ?? batches[0] ?? null);
    setSelectedVm(null);
    setActiveTab("tasks");
    setQuery("");
    setStatusFilter("全部");
    setSelectedVmIds([]);
  }

  function runMigrationTaskAction(action: string, taskId?: string) {
    const count = taskId ? 1 : selectedVmIds.length;
    if (!count) return;
    onAction(action, taskId ? [taskId] : selectedVmIds);
    if (action === "删除") setSelectedVmIds([]);
  }

  return (
    <div
      className="panel-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="archive-panel task-panel"
        role="region"
        aria-label={t("任务管理")}
      >
        <header>
          <div>
            <p>MIGRATION TASK MANAGEMENT</p>
            <h2>{t("迁移任务管理")}</h2>
            <span>
              {t(
                activeTab === "batches"
                  ? "按批次管理迁移计划，并下钻查看虚拟机任务"
                  : activeBatch
                    ? `${activeBatch.id} · ${activeBatch.batchPhase} · ${activeBatch.stageType}`
                    : "等待规划子智能体生成迁移批次",
              )}
            </span>
          </div>
          <div className="task-head-actions">
            <button onClick={onClose} aria-label={t("关闭")}>
              ×
            </button>
          </div>
        </header>
        <nav className="task-primary-tabs" aria-label={t("迁移任务管理视图")}>
          <button
            className={activeTab === "batches" ? "active" : ""}
            onClick={() => {
              setActiveTab("batches");
              setSelectedVm(null);
            }}
          >
            {t("迁移批次")}
            <b>{t(batches.length)}</b>
          </button>
          <button
            className={activeTab === "tasks" ? "active" : ""}
            onClick={() => openTaskTab()}
          >
            {t("迁移任务")}
            <b>{t(totalVms)}</b>
          </button>
        </nav>

        {activeTab === "batches" ? (
          <>
            <div className="panel-kpis">
              <div data-tone="brand">
                <small>{t("批次任务")}</small>
                <strong>{t(batches.length)}</strong>
                <em>
                  {t(projectExists ? "规划子智能体生成" : "等待规划设计")}
                </em>
              </div>
              <div data-tone="info">
                <small>{t("虚拟机范围")}</small>
                <strong>{t(totalVms)}</strong>
                <em>{t("覆盖全部规划范围")}</em>
              </div>
              <div data-tone="info">
                <small>{t("批次阶段")}</small>
                <strong>{t(batches.length ? 3 : 0)}</strong>
                <em>{t("试点 · 攻坚 · 扩展")}</em>
              </div>
            </div>
            <div className="batch-toolbar">
              <div>
                {(["全部", "pilot", "core", "scale"] as const).map((phase) => (
                  <button
                    key={phase}
                    className={batchPhaseFilter === phase ? "active" : ""}
                    onClick={() => {
                      setBatchPhaseFilter(phase);
                      setSelectedGanttBatchId(null);
                    }}
                  >
                    {t(phase === "全部" ? "全部批次" : phase)}{" "}
                    {t(
                      phase === "全部"
                        ? batches.length
                        : batches.filter((batch) => batch.batchPhase === phase)
                            .length,
                    )}
                  </button>
                ))}
              </div>
              <button
                className="gantt-button"
                disabled={!batches.length}
                onClick={() => {
                  setShowGantt((value) => !value);
                  if (!showGantt) onNotify("迁移批次甘特图已生成");
                }}
              >
                {t(showGantt ? "收起甘特图" : "▤ 生成甘特图")}
              </button>
              <button
                onClick={() => onNotify("批次任务由规划子智能体自动生成")}
              >
                {t("＋ 创建任务")}
              </button>
            </div>
            {showGantt && (
              <div className="gantt-card">
                <div className="gantt-head">
                  <div>
                    <small>MIGRATION BATCH TIMELINE</small>
                    <h3>
                      {t(
                        batchPhaseFilter === "全部"
                          ? "全部迁移批次甘特图"
                          : `${batchPhaseFilter}阶段批次甘特图`,
                      )}
                    </h3>
                  </div>
                  <span>
                    {t(`2026 年 9 月 · 共${visibleBatches.length} 个批次`)}
                  </span>
                </div>
                <div className="gantt-scroll">
                  <div className="gantt-calendar">
                    <div className="gantt-date-row">
                      <span>{t("批次 / 阶段类型")}</span>
                      <div>
                        {ganttDays.map((day) => (
                          <b key={day}>{t(`${day}日`)}</b>
                        ))}
                      </div>
                    </div>
                    {visibleBatches.map((batch) => {
                      const startDay = Number(batch.startDate.slice(-2));
                      const left = ((startDay - 7) / ganttDays.length) * 100;
                      const width =
                        (batch.durationDays / ganttDays.length) * 100;
                      return (
                        <div
                          className={`gantt-row ${selectedGanttBatchId === batch.id ? "selected" : ""}`}
                          key={batch.id}
                        >
                          <span>
                            <strong>{t(batch.id)}</strong>
                            <small>
                              {t(batch.batchPhase)} · {t(batch.stageType)}
                            </small>
                          </span>
                          <div className="gantt-track">
                            {ganttDays.map((day) => (
                              <i key={day} />
                            ))}
                            <button
                              className={`gantt-bar phase-${batch.batchPhase} ${selectedGanttBatchId === batch.id ? "selected" : ""}`}
                              style={{ left: `${left}%`, width: `${width}%` }}
                              aria-pressed={selectedGanttBatchId === batch.id}
                              onClick={() => {
                                setSelectedGanttBatchId(batch.id);
                                window.setTimeout(
                                  () =>
                                    document
                                      .getElementById(
                                        `batch-row-${projectId}-${batch.id}`,
                                      )
                                      ?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "nearest",
                                      }),
                                  0,
                                );
                              }}
                            >
                              <b>
                                {t(
                                  `${batch.durationDays}天 ·${batch.vmNames.length}台`,
                                )}
                              </b>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="gantt-legend">
                  <span>
                    <i className="pilot" />
                    {t("pilot")}
                  </span>
                  <span>
                    <i className="tackle" />
                    {t("core")}
                  </span>
                  <span>
                    <i className="expand" />
                    {t("scale")}
                  </span>
                </div>
              </div>
            )}
            <div className="batch-table-wrap">
              <table className="batch-table">
                <thead>
                  <tr>
                    <th>{t("批次编号")}</th>
                    <th>{t("批次阶段")}</th>
                    <th>{t("虚拟机数量")}</th>
                    <th>{t("虚拟机列表")}</th>
                    <th>{t("阶段类型")}</th>
                    <th>{t("开始日期")}</th>
                    <th>{t("结束日期")}</th>
                    <th>{t("持续天数")}</th>
                    <th>{t("状态")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBatches.length ? (
                    visibleBatches.map((batch) => (
                      <tr
                        id={`batch-row-${projectId}-${batch.id}`}
                        className={
                          selectedGanttBatchId === batch.id
                            ? "selected-batch"
                            : ""
                        }
                        key={batch.id}
                      >
                        <td>
                          <strong>{t(batch.id)}</strong>
                        </td>
                        <td>
                          <span
                            className={`batch-phase phase-${batch.batchPhase}`}
                          >
                            {t(batch.batchPhase)}
                          </span>
                        </td>
                        <td>
                          <strong className="vm-count">
                            {t(`${batch.vmNames.length} 台`)}
                          </strong>
                        </td>
                        <td>
                          <button
                            className="vm-list-link"
                            onClick={() => openTaskTab(batch)}
                          >
                            <b>{t("清单")}</b>
                            <small>
                              {batch.vmNames.slice(0, 2).join("、")}
                              {batch.vmNames.length > 2 ? "…" : ""}
                            </small>
                            <em>{t("查看明细 →")}</em>
                          </button>
                        </td>
                        <td>{t(batch.stageType)}</td>
                        <td>{t(batch.startDate)}</td>
                        <td>{t(batch.endDate)}</td>
                        <td>{t(`${batch.durationDays} 天`)}</td>
                        <td>
                          <span
                            className={
                              completedBatchIds.includes(batch.id)
                                ? "task-ready batch-complete"
                                : "task-ready"
                            }
                          >
                            <i />
                            {t(
                              completedBatchIds.includes(batch.id)
                                ? "迁移完成"
                                : "已规划",
                            )}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="empty-row" colSpan={9}>
                        {t(
                          batches.length
                            ? `暂无${batchPhaseFilter}阶段的批次任务`
                            : projectExists
                              ? "完成规划信息上传后，批次任务将在这里自动生成"
                              : "请先创建项目",
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : selectedVm ? (
          <div className="vm-detail-view">
            <div className="vm-detail-head">
              <button onClick={() => setSelectedVm(null)}>
                {t("← 返回迁移任务")}
              </button>
              <div>
                <small>VM MIGRATION DETAIL</small>
                <h3>{t(selectedVm.name)}</h3>
                <p>
                  {t(selectedVm.id)} · {t(activeBatch?.id)} ·{" "}
                  {t(isCreated(selectedVm.id) ? "任务已创建" : "任务尚未创建")}
                </p>
              </div>
              <span
                className={isCreated(selectedVm.id) ? "created" : "not-created"}
              >
                {t(
                  isCreated(selectedVm.id)
                    ? "已创建迁移任务"
                    : "待创建迁移任务",
                )}
              </span>
            </div>
            {isCreated(selectedVm.id) ? (
              <>
                <div className="vm-detail-summary">
                  <div>
                    <small>{t("虚拟机 ID")}</small>
                    <strong>{t(selectedVm.id)}</strong>
                  </div>
                  <div>
                    <small>{t("虚拟机名称")}</small>
                    <strong>{t(selectedVm.name)}</strong>
                  </div>
                  <div>
                    <small>{t("迁移方式")}</small>
                    <strong>
                      {t(
                        migrationMethodLabels[
                          selectedVm.migrationMethod ?? "agentless"
                        ],
                      )}
                    </strong>
                  </div>
                  <div>
                    <small>{t("操作系统版本")}</small>
                    <strong>{t(selectedVmOs)}</strong>
                  </div>
                  <div>
                    <small>{t("迁移方案")}</small>
                    <strong>{t("免代理")}</strong>
                  </div>
                </div>
                <div className="created-task-list">
                  <div className="created-task-list-head">
                    <div>
                      <small>MIGRATION TASK LIST</small>
                      <h3>{t("对应迁移任务列表")}</h3>
                    </div>
                    <span>{t(`共${migrationTaskRows.length} 项`)}</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>{t("任务编号")}</th>
                        <th>{t("任务类型")}</th>
                        <th>{t("任务状态")}</th>
                        <th>{t("任务进度")}</th>
                        <th>{t("开始时间")}</th>
                        <th>{t("结束时间")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {migrationTaskRows.map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell, index) => (
                            <td key={`${row[0]}-${index}`}>
                              {index === 2 ? (
                                <span
                                  className={`detail-task-status ${cell === "已完成" ? "done" : cell === "running" ? "running" : ""}`}
                                >
                                  {t(cell)}
                                </span>
                              ) : (
                                cell
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="uncreated-vm-detail">
                <div className="vm-detail-summary">
                  <div>
                    <small>{t("虚拟机 ID")}</small>
                    <strong>{t(selectedVm.id)}</strong>
                  </div>
                  <div>
                    <small>{t("虚拟机名称")}</small>
                    <strong>{t(selectedVm.name)}</strong>
                  </div>
                  <div>
                    <small>{t("迁移方式")}</small>
                    <strong>
                      {t(
                        migrationMethodLabels[
                          selectedVm.migrationMethod ?? "agentless"
                        ],
                      )}
                    </strong>
                  </div>
                  <div>
                    <small>{t("操作系统版本")}</small>
                    <strong>{t(selectedVmOs)}</strong>
                  </div>
                  <div>
                    <small>{t("迁移方案")}</small>
                    <strong>{t("免代理")}</strong>
                  </div>
                </div>
                <section>
                  <header>
                    <div>
                      <small>RISK ITEMS</small>
                      <h3>{t("风险项")}</h3>
                    </div>
                    <span>{t(`${selectedVmRisks.length} 项待处理`)}</span>
                  </header>
                  {selectedVmRisks.length ? (
                    <div className="vm-risk-list">
                      {selectedVmRisks.map((risk) => (
                        <div key={risk.id}>
                          <Status value={risk.level} />
                          <p>
                            <strong>{t(risk.description)}</strong>
                            <small>
                              R-{t(String(risk.id).padStart(3, "0"))} ·{" "}
                              {t(stageName[risk.stage])} ·{" "}
                              {t(risk.closed ? "已闭环" : "待闭环")}
                            </small>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="vm-no-risk">
                      <span>✓</span>
                      <p>
                        <strong>{t("当前虚拟机未关联未闭环风险")}</strong>
                        <small>
                          {t("任务创建前仍将执行兼容性与资源检查。")}
                        </small>
                      </p>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="migration-task-context">
              <div>
                <small>{t("当前批次")}</small>
                <Select
                  aria-label={t("当前批次")}
                  value={activeBatch?.id ?? ""}
                  onValueChange={(value) => {
                    setSelectedBatch(
                      batches.find((batch) => batch.id === value) ?? null,
                    );
                    setQuery("");
                    setStatusFilter("全部");
                    setSelectedVmIds([]);
                  }}
                  disabled={!batches.length}
                >
                  {batches.length ? (
                    batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {t(batch.id)} · {t(batch.batchPhase)} ·{" "}
                        {t(batch.stageType)}
                      </option>
                    ))
                  ) : (
                    <option value={"暂无迁移批次"}>{t("暂无迁移批次")}</option>
                  )}
                </Select>
              </div>
              <p>
                <span>
                  <i className="created" />
                  {t(`已创建${createdCount}`)}
                </span>
                <span>
                  <i />
                  {t(`未创建${Math.max(0, vmTasks.length - createdCount)}`)}
                </span>
              </p>
            </div>
            <div className="vm-task-tabs">
              {(["全部", "created", "未创建"] as const).map((status) => {
                const count =
                  status === "全部"
                    ? vmTasks.length
                    : status === "created"
                      ? createdCount
                      : vmTasks.length - createdCount;
                return (
                  <button
                    key={status}
                    className={statusFilter === status ? "active" : ""}
                    onClick={() => setStatusFilter(status)}
                  >
                    {t(status)} <b>{t(count)}</b>
                  </button>
                );
              })}
            </div>
            <div className="vm-task-toolbar migration-task-toolbar">
              <div className="migration-bulk-actions">
                {[
                  "同步",
                  "paused",
                  "删除",
                  "定时同步",
                  "日志下载",
                  "取消定时同步",
                ].map((action) => (
                  <button
                    key={action}
                    disabled={!selectedVmIds.length}
                    onClick={() => runMigrationTaskAction(action)}
                  >
                    {t(action)}
                  </button>
                ))}
                <span>{t(`已选择${selectedVmIds.length}`)}</span>
              </div>
              <label>
                <span>⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("输入虚拟机 ID、名称或目标 IP")}
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
            <div className="migration-vm-table-wrap">
              <table className="migration-vm-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label={t("选择全部迁移任务")}
                        checked={
                          visibleVmTasks.length > 0 &&
                          visibleVmTasks.every((task) =>
                            selectedVmIds.includes(task.id),
                          )
                        }
                        onChange={(event) =>
                          setSelectedVmIds(
                            event.target.checked
                              ? Array.from(
                                  new Set([
                                    ...selectedVmIds,
                                    ...visibleVmTasks.map((task) => task.id),
                                  ]),
                                )
                              : selectedVmIds.filter(
                                  (id) =>
                                    !visibleVmTasks.some(
                                      (task) => task.id === id,
                                    ),
                                ),
                          )
                        }
                      />
                    </th>
                    <th>{t("虚拟机 ID")}</th>
                    <th>{t("虚拟机名称")}</th>
                    <th>{t("操作系统版本")}</th>
                    <th>{t("迁移方案")}</th>
                    <th>{t("任务创建状态")}</th>
                    <th>{t("风险项")}</th>
                    <th>{t("目标 IP")}</th>
                    <th>{t("功能操作")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleVmTasks.length ? (
                    visibleVmTasks.map((task) => {
                      const creation = creationByVm.get(task.id);
                      const riskCount = risks.filter(
                        (risk) =>
                          !risk.closed && task.riskIds.includes(risk.id),
                      ).length;
                      const os = creation?.os ?? task.os;
                      return (
                        <tr key={task.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={t(`选择 ${task.name}`)}
                              checked={selectedVmIds.includes(task.id)}
                              onChange={(event) =>
                                setSelectedVmIds((ids) =>
                                  event.target.checked
                                    ? [...ids, task.id]
                                    : ids.filter((id) => id !== task.id),
                                )
                              }
                            />
                          </td>
                          <td>
                            <strong>{t(task.id)}</strong>
                          </td>
                          <td>{task.name}</td>
                          <td>{t(os)}</td>
                          <td>
                            <span className="agentless-tag">{t("免代理")}</span>
                          </td>
                          <td>
                            <span
                              className={`creation-state ${isCreated(task.id) ? "created" : ""}`}
                            >
                              <i />
                              {t(isCreated(task.id) ? "created" : "未创建")}
                            </span>
                          </td>
                          <td>
                            {riskCount ? (
                              <span className="vm-risk-count">
                                {t(`${riskCount} 项`)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{t(task.targetIp)}</td>
                          <td>
                            <div className="migration-row-actions">
                              <button
                                className="detail"
                                onClick={() => setSelectedVm(task)}
                              >
                                {t("查看明细")}
                              </button>
                              {[
                                "同步",
                                "paused",
                                "删除",
                                "定时同步",
                                "日志下载",
                                "取消定时同步",
                              ].map((action) => (
                                <button
                                  key={action}
                                  onClick={() =>
                                    runMigrationTaskAction(action, task.id)
                                  }
                                >
                                  {t(action)}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="empty-row" colSpan={9}>
                        {t(
                          batches.length
                            ? "暂无符合条件的虚拟机"
                            : "完成规划设计后显示迁移任务",
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="vm-table-foot">
              <span>{t(`总条数：${visibleVmTasks.length}`)}</span>
              <div>
                <button>{t("10 / 页⌄")}</button>
                <button>‹</button>
                <b>1</b>
                <button>›</button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
