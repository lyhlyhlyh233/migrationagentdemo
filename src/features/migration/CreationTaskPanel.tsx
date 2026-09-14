import type { CreationTask } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { Select } from "@/shared/ui/Select";
import { Status } from "@/shared/ui/Status";
import { useState } from "react";
export function CreationTaskPanel({
  tasks,
  locked,
  onChange,
  onCreate,
  onClose,
  onNotify,
}: {
  tasks: CreationTask[];
  locked: boolean;
  onChange: (tasks: CreationTask[]) => Promise<boolean>;
  onCreate: () => void;
  onClose: () => void;
  onNotify: (message: string) => void;
}) {
  const t = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    tasks.map((task) => task.id),
  );
  const [editingTask, setEditingTask] = useState<CreationTask | null>(null);
  const [draftTask, setDraftTask] = useState<CreationTask | null>(null);
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [computeResource, setComputeResource] = useState(
    "FusionCompute-生产集群-A",
  );
  const [portGroup, setPortGroup] = useState("managePortgroup");
  const [delayAllocation, setDelayAllocation] = useState(false);
  const [keepUuid, setKeepUuid] = useState(false);
  const visibleTasks = tasks.filter((task) =>
    `${task.hostName}${task.vmName}${task.taskName}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const confirmedCount = tasks.filter(
    (task) => task.status === "confirmed" || task.status === "created",
  ).length;
  const allConfirmed =
    tasks.length > 0 &&
    tasks.every(
      (task) => task.status === "confirmed" || task.status === "created",
    );

  function openWizard(task: CreationTask) {
    if (locked || task.status === "created") {
      onNotify("任务正在执行或已创建，配置已锁定");
      return;
    }
    setEditingTask(task);
    setDraftTask({ ...task });
    setComputeResource(task.computeResource ?? "FusionCompute-生产集群-A");
    setPortGroup(task.portGroup ?? "managePortgroup");
    setDelayAllocation(task.delayAllocation ?? false);
    setKeepUuid(task.keepUuid ?? false);
    setStep(1);
  }

  async function confirmTask() {
    if (
      locked ||
      !editingTask ||
      !draftTask ||
      tasks.find((task) => task.id === editingTask.id)?.status === "created"
    )
      return;
    if (
      !(await onChange([
        {
          ...draftTask,
          computeResource,
          portGroup,
          delayAllocation,
          keepUuid,
          status: "confirmed",
        },
      ]))
    )
      return;
    setEditingTask(null);
    setDraftTask(null);
    setStep(1);
    onNotify(`${draftTask.vmName} 任务信息已确认`);
  }

  async function confirmSelectedTasks() {
    if (locked) return;
    const confirmable = tasks.filter(
      (task) => selectedIds.includes(task.id) && task.status === "unconfigured",
    );
    if (!confirmable.length) {
      onNotify("所选任务已确认或已创建");
      return;
    }
    if (
      !(await onChange(
        confirmable.map((task) => ({ ...task, status: "confirmed" })),
      ))
    )
      return;
    onNotify(`已批量确认 ${confirmable.length} 个待新建任务`);
  }

  function createAllTasks() {
    if (locked || tasks.every((task) => task.status === "created")) return;
    if (!allConfirmed) {
      onNotify(`仍有 ${tasks.length - confirmedCount} 个任务待确认`);
      return;
    }
    onCreate();
  }

  if (editingTask && draftTask)
    return (
      <div className="panel-backdrop">
        <aside
          className="archive-panel creation-panel creation-wizard"
          role="region"
          aria-label={t("创建迁移任务")}
        >
          <header>
            <div>
              <p>CREATE MIGRATION TASK</p>
              <h2>{t("配置迁移任务")}</h2>
              <span>
                {t(editingTask.vmName)} · {t(editingTask.id)}
              </span>
            </div>
            <button
              onClick={() => setEditingTask(null)}
              aria-label={t("关闭配置")}
            >
              ×
            </button>
          </header>
          <div className="wizard-steps">
            <button
              className={step === 1 ? "active" : step > 1 ? "done" : ""}
              onClick={() => setStep(1)}
            >
              <i>{t(step > 1 ? "✓" : "1")}</i>
              <span>{t("任务配置")}</span>
            </button>
            <b />
            <button
              className={step === 2 ? "active" : step > 2 ? "done" : ""}
              onClick={() => step > 1 && setStep(2)}
            >
              <i>{t(step > 2 ? "✓" : "2")}</i>
              <span>{t("目的 VM 与网络配置")}</span>
            </button>
            <b />
            <button
              className={step === 3 ? "active" : ""}
              onClick={() => step > 2 && setStep(3)}
            >
              <i>3</i>
              <span>{t("确认信息")}</span>
            </button>
          </div>
          <div className="wizard-body">
            {step === 1 && (
              <div className="wizard-section">
                <div className="wizard-section-head">
                  <small>STEP 1</small>
                  <h3>{t("确认源端虚拟机与任务信息")}</h3>
                  <p>{t("源端检查已通过，可修改任务名称后进入目的端配置。")}</p>
                </div>
                <div className="source-summary">
                  <div>
                    <small>{t("源端主机")}</small>
                    <strong>{draftTask.hostName}</strong>
                  </div>
                  <div>
                    <small>{t("虚拟机")}</small>
                    <strong>{draftTask.vmName}</strong>
                  </div>
                  <div>
                    <small>{t("操作系统")}</small>
                    <strong>{t(draftTask.os)}</strong>
                  </div>
                  <div>
                    <small>{t("检查结果")}</small>
                    <strong className="check-pass">{t("✓ 通过")}</strong>
                  </div>
                </div>
                <div className="wizard-form">
                  <label className="wide">
                    <span>{t("任务名称")}</span>
                    <input
                      value={draftTask.taskName}
                      onChange={(event) =>
                        setDraftTask({
                          ...draftTask,
                          taskName: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>{t("固件版本")}</span>
                    <Select
                      aria-label={t("固件版本")}
                      value={draftTask.firmware}
                      onValueChange={(value) =>
                        setDraftTask({
                          ...draftTask,
                          firmware: value as CreationTask["firmware"],
                        })
                      }
                    >
                      <option value={"BIOS"}>BIOS</option>
                      <option value={"UEFI"}>UEFI</option>
                    </Select>
                  </label>
                  <label>
                    <span>{t("迁移策略")}</span>
                    <Select
                      aria-label={t("迁移策略")}
                      value={draftTask.strategy ?? "按计划执行"}
                      onValueChange={(strategy) =>
                        setDraftTask({ ...draftTask, strategy })
                      }
                    >
                      <option value={"按计划执行"}>{t("按计划执行")}</option>
                      <option value={"立即执行"}>{t("立即执行")}</option>
                    </Select>
                  </label>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="wizard-section">
                <div className="wizard-section-head">
                  <small>STEP 2</small>
                  <h3>{t("目的 VM 与网络配置")}</h3>
                  <p>{t("确认目标计算资源、规格、磁盘和端口组映射。")}</p>
                </div>
                <div className="resource-hints">
                  <span>{t("推荐规格")}</span>
                  <b>{t(`CPU：${draftTask.cpu} 核`)}</b>
                  <b>{t(`内存：${draftTask.memory}`)}</b>
                </div>
                <div className="wizard-form">
                  <label className="wide">
                    <span>{t("目的虚拟机名称")}</span>
                    <input
                      value={draftTask.vmName}
                      onChange={(event) =>
                        setDraftTask({
                          ...draftTask,
                          vmName: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="wide">
                    <span>{t("计算资源")}</span>
                    <Select
                      aria-label={t("计算资源")}
                      value={computeResource}
                      onValueChange={setComputeResource}
                    >
                      <option value={"FusionCompute-生产集群-A"}>
                        {t("FusionCompute-生产集群-A")}
                      </option>
                      <option value={"FusionCompute-生产集群-B"}>
                        {t("FusionCompute-生产集群-B")}
                      </option>
                    </Select>
                  </label>
                  <label className="wide">
                    <span>{t("操作系统版本")}</span>
                    <input
                      value={draftTask.os}
                      onChange={(event) =>
                        setDraftTask({ ...draftTask, os: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>{t("CPU 核数")}</span>
                    <input
                      type="number"
                      min="1"
                      value={draftTask.cpu}
                      onChange={(event) =>
                        setDraftTask({
                          ...draftTask,
                          cpu: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>{t("内存大小")}</span>
                    <input
                      value={draftTask.memory}
                      onChange={(event) =>
                        setDraftTask({
                          ...draftTask,
                          memory: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>{t("显卡")}</span>
                    <Select
                      aria-label={t("显卡")}
                      value={draftTask.video ?? "VGA · 4MB"}
                      onValueChange={(video) =>
                        setDraftTask({ ...draftTask, video })
                      }
                    >
                      <option value={"VGA · 4MB"}>VGA · 4MB</option>
                      <option value={"VGA · 8MB"}>VGA · 8MB</option>
                    </Select>
                  </label>
                  <label className="wide">
                    <span>{t("网卡迁移 / 端口组")}</span>
                    <Select
                      aria-label={t("网卡迁移 / 端口组")}
                      value={portGroup}
                      onValueChange={setPortGroup}
                    >
                      <option value={"managePortgroup"}>managePortgroup</option>
                      <option value={"business-prod-vlan"}>
                        business-prod-vlan
                      </option>
                      <option value={"database-backend-vlan"}>
                        database-backend-vlan
                      </option>
                    </Select>
                  </label>
                  <label className="wide">
                    <span>{t("磁盘配置")}</span>
                    <input
                      value={draftTask.disk}
                      onChange={(event) =>
                        setDraftTask({ ...draftTask, disk: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="advanced-options">
                  <label>
                    <button
                      type="button"
                      className={delayAllocation ? "on" : ""}
                      onClick={() => setDelayAllocation((value) => !value)}
                    >
                      <i />
                    </button>
                    <span>
                      <strong>{t("延迟分配")}</strong>
                      <small>{t("按需分配目标存储空间")}</small>
                    </span>
                  </label>
                  <label>
                    <button
                      type="button"
                      className={keepUuid ? "on" : ""}
                      onClick={() => setKeepUuid((value) => !value)}
                    >
                      <i />
                    </button>
                    <span>
                      <strong>{t("UUID 与源端保持一致")}</strong>
                      <small>{t("保留源端虚拟机唯一标识")}</small>
                    </span>
                  </label>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="wizard-section confirm-section">
                <div className="wizard-section-head">
                  <small>STEP 3</small>
                  <h3>{t("确认迁移任务信息")}</h3>
                  <p>{t("确认无误后，该任务将进入批量任务创建队列。")}</p>
                </div>
                <div className="confirm-grid">
                  <div>
                    <small>{t("任务名称")}</small>
                    <strong>{draftTask.taskName}</strong>
                  </div>
                  <div>
                    <small>{t("源端虚拟机")}</small>
                    <strong>{t(editingTask.vmName)}</strong>
                  </div>
                  <div>
                    <small>{t("目的虚拟机")}</small>
                    <strong>{draftTask.vmName}</strong>
                  </div>
                  <div>
                    <small>{t("计算资源")}</small>
                    <strong>{computeResource}</strong>
                  </div>
                  <div>
                    <small>{t("CPU / 内存")}</small>
                    <strong>
                      {t(`${draftTask.cpu} 核 /${draftTask.memory}`)}
                    </strong>
                  </div>
                  <div>
                    <small>{t("磁盘")}</small>
                    <strong>{t(draftTask.disk)}</strong>
                  </div>
                  <div>
                    <small>{t("网络端口组")}</small>
                    <strong>{t(portGroup)}</strong>
                  </div>
                  <div>
                    <small>{t("高级配置")}</small>
                    <strong>
                      {t(delayAllocation ? "延迟分配" : "预分配")} ·{" "}
                      {t(keepUuid ? "保留 UUID" : "新建 UUID")}
                    </strong>
                  </div>
                </div>
                <div className="confirm-notice">
                  <span>!</span>
                  <p>
                    <strong>{t("确认后仍可在批量创建前修改")}</strong>
                    {t("所有任务均确认后，“批量创建任务”按钮才会开放。")}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="wizard-foot">
            <button
              onClick={() =>
                step === 1
                  ? setEditingTask(null)
                  : setStep((value) => value - 1)
              }
            >
              {t(step === 1 ? "取消" : "上一步")}
            </button>
            {step < 3 ? (
              <button
                className="primary"
                onClick={() => setStep((value) => value + 1)}
                disabled={step === 1 && !draftTask.taskName.trim()}
              >
                {t("下一步 →")}
              </button>
            ) : (
              <button className="primary" onClick={confirmTask}>
                {t("确认任务信息")}
              </button>
            )}
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
        className="archive-panel creation-panel"
        role="region"
        aria-label={t("待新建迁移任务")}
      >
        <header>
          <div>
            <p>NEW MIGRATION TASK QUEUE</p>
            <h2>{t("今日待新建任务")}</h2>
            <span>{t("逐台查看并确认目的 VM 配置，全部确认后批量创建")}</span>
          </div>
          <button onClick={onClose} aria-label={t("关闭")}>
            ×
          </button>
        </header>
        <div className="creation-summary">
          <div data-tone="info">
            <small>{t("待新建")}</small>
            <strong>
              {t(tasks.filter((task) => task.status === "unconfigured").length)}
            </strong>
          </div>
          <div data-tone="brand">
            <small>{t("confirmed")}</small>
            <strong>
              {t(tasks.filter((task) => task.status === "confirmed").length)}
            </strong>
          </div>
          <div data-tone="success">
            <small>{t("created")}</small>
            <strong>
              {t(tasks.filter((task) => task.status === "created").length)}
            </strong>
          </div>
          <span>
            <i />
            {t("源端检查通过，任务信息来自今日迁移批次")}
          </span>
        </div>
        <p className="shared-task-note" role="status">
          {t(
            locked
              ? "任务已提交，所有会话共享执行状态，配置已锁定。"
              : "确认的配置会同步到当前项目的所有会话。",
          )}
        </p>
        <div className="creation-toolbar">
          <div>
            <button
              className="bulk-confirm"
              disabled={
                locked ||
                !selectedIds.length ||
                !tasks.some(
                  (task) =>
                    selectedIds.includes(task.id) &&
                    task.status === "unconfigured",
                )
              }
              onClick={confirmSelectedTasks}
            >
              {t("✓ 批量确认")}
            </button>
            <button
              className="primary"
              disabled={
                locked ||
                !allConfirmed ||
                tasks.every((task) => task.status === "created")
              }
              onClick={createAllTasks}
            >
              {t("＋ 批量创建任务")}
            </button>
            <span>{t(`已选择${selectedIds.length}`)}</span>
          </div>
          <label>
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("输入虚拟机或任务名称")}
            />
          </label>
        </div>
        <div className="creation-table-wrap">
          <table className="creation-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === tasks.length && tasks.length > 0
                    }
                    onChange={(event) =>
                      setSelectedIds(
                        event.target.checked
                          ? tasks.map((task) => task.id)
                          : [],
                      )
                    }
                    aria-label={t("选择全部")}
                  />
                </th>
                <th>{t("主机名称")}</th>
                <th>{t("虚拟机名称")}</th>
                <th>{t("状态")}</th>
                <th>{t("操作系统")}</th>
                <th>{t("固件版本")}</th>
                <th>CPU</th>
                <th>{t("内存")}</th>
                <th>{t("磁盘")}</th>
                <th>{t("VMTools 状态")}</th>
                <th>{t("检查结果")}</th>
                <th>{t("任务名称")}</th>
                <th>{t("任务状态")}</th>
                <th>{t("操作")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(task.id)}
                      onChange={(event) =>
                        setSelectedIds((ids) =>
                          event.target.checked
                            ? [...ids, task.id]
                            : ids.filter((id) => id !== task.id),
                        )
                      }
                      aria-label={t(`选择 ${task.vmName}`)}
                    />
                  </td>
                  <td>{task.hostName}</td>
                  <td>
                    <strong>{task.vmName}</strong>
                    <small>{t(task.id)}</small>
                  </td>
                  <td>{t(task.powerState)}</td>
                  <td>{t(task.os)}</td>
                  <td>{t(task.firmware)}</td>
                  <td>{t(task.cpu)}</td>
                  <td>{t(task.memory)}</td>
                  <td>{t(task.disk)}</td>
                  <td>{t(task.vmtools)}</td>
                  <td>
                    <span className="check-pass">✓ {t(task.check)}</span>
                  </td>
                  <td>{task.taskName}</td>
                  <td>
                    <Status value={task.status} />
                  </td>
                  <td>
                    <button
                      className="configure-task"
                      disabled={locked || task.status === "created"}
                      onClick={() => openWizard(task)}
                    >
                      {t(
                        task.status === "unconfigured"
                          ? "配置任务"
                          : task.status === "confirmed"
                            ? "查看 / 修改"
                            : "created",
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="creation-foot">
          <span>
            {t(
              `共${visibleTasks.length} 条 · 已确认${confirmedCount}/${tasks.length}`,
            )}
          </span>
          <p>
            {t(
              allConfirmed
                ? "全部任务已确认，可以批量创建"
                : `还有 ${tasks.length - confirmedCount} 个任务需要确认`,
            )}
          </p>
        </div>
      </aside>
    </div>
  );
}
