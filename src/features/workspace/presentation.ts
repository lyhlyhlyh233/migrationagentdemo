import type {
  ExecutionTaskKind,
  ProjectSnapshot,
  StageId,
} from "@/domain/models";
import { completedBatches } from "@/domain/policies";
import type { WorkStep } from "@/features/workspace/ExecutionInspector";
export function workspacePresentation(s: ProjectSnapshot) {
  const {
    risks,
    assessmentStatus,
    planningStatus,
    planningWorkbook,
    files,
    vmCount,
    batchTasks,
    batchConfirmation,
    mdStatus,
    executionMetrics,
    executionApprovals,
    validationTasks,
  } = s;
  const project = s.info;
  const confirmedValidationCount = validationTasks.filter(
    (v) => v.confirmed,
  ).length;
  const completedBatchIds = completedBatches(s);
  const researchHigh = risks.filter(
    (risk) =>
      risk.stage === "research" && risk.level === "high" && !risk.closed,
  ).length;
  const planningHigh = risks.filter(
    (risk) =>
      risk.stage === "planning" && risk.level === "high" && !risk.closed,
  ).length;
  const planned = planningStatus === "completed";
  const assessed = assessmentStatus === "completed";
  const step = (
    label: string,
    detail: string,
    done: boolean,
    active = false,
    blocked = false,
  ): WorkStep => ({
    label,
    detail,
    state: done ? "done" : blocked ? "blocked" : active ? "active" : "waiting",
  });
  const stageSteps: Record<StageId, WorkStep[]> = {
    research: [
      step(
        "核对输入资料",
        `${Number(Boolean(files.rvtools)) + Number(Boolean(files.presales))} / 2 份资料已就绪`,
        Boolean(files.rvtools && files.presales),
        Boolean(project),
      ),
      step(
        "解析资产清单",
        assessed ? `已识别 ${vmCount} 台虚拟机` : "核对资源配置与容量基线",
        assessed,
        assessmentStatus === "running",
      ),
      step(
        "兼容性与风险评估",
        assessed
          ? `识别 ${risks.filter((r) => r.stage === "research").length} 项风险`
          : "检查源端与目标端兼容性",
        assessed,
        assessmentStatus === "running",
      ),
      step(
        "确认评估结果",
        assessed && !researchHigh
          ? "高风险已闭环，可以进入规划"
          : assessed
            ? `${researchHigh} 项高风险待人工确认`
            : "输出评估报告，确认风险",
        assessed && !researchHigh,
        false,
        assessed && researchHigh > 0,
      ),
    ],
    planning: [
      step(
        "确认迁移范围",
        `${vmCount} 台虚拟机`,
        ["details-pending", "generating", "completed"].includes(planningStatus),
        planningStatus === "scope-review",
      ),
      step(
        "补充业务信息",
        "业务分级、依赖关系与迁移窗口",
        Boolean(planningWorkbook),
        planningStatus === "details-pending",
      ),
      step(
        "生成批次与 RunBook",
        planned
          ? `${batchTasks.length} 个批次已生成`
          : "按试点、攻坚、扩展组织计划",
        planned,
        planningStatus === "generating",
      ),
      step(
        "确认风险与批次",
        planned && planningHigh
          ? `${planningHigh} 项高风险待闭环`
          : "人工确认后进入实施",
        batchConfirmation === "confirmed",
        planned && !planningHigh && batchConfirmation !== "confirmed",
        planned && planningHigh > 0,
      ),
    ],
    migration: [
      step(
        "连接近端 MD",
        "检查心跳与项目身份",
        ["connected", "checking-config", "ready"].includes(mdStatus),
        mdStatus === "checking-connection",
      ),
      step(
        "检查源端与目标端",
        "VMware、FusionCompute 和端口映射",
        mdStatus === "ready",
        ["connected", "checking-config"].includes(mdStatus),
      ),
      ...(["creation", "sync", "cutover"] as ExecutionTaskKind[]).map((kind) =>
        step(
          {
            creation: "创建迁移任务",
            sync: "增量数据同步",
            cutover: "执行割接任务",
          }[kind],
          `${executionMetrics[kind].completed} / ${executionMetrics[kind].total} 已完成${!executionApprovals[kind] ? " · 待确认" : ""}`,
          executionMetrics[kind].total > 0 &&
            executionMetrics[kind].completed === executionMetrics[kind].total,
          executionApprovals[kind] &&
            executionMetrics[kind].completed < executionMetrics[kind].total,
        ),
      ),
    ],
    validation: [
      step(
        "采集源端与目标端配置",
        `${validationTasks.length} 台虚拟机进入验证`,
        validationTasks.length > 0,
      ),
      step(
        "对比 25 项配置",
        "CPU、内存、磁盘、网络、显卡",
        validationTasks.length > 0,
      ),
      step(
        "人工确认验收",
        `${confirmedValidationCount} / ${validationTasks.length} 台已确认`,
        validationTasks.length > 0 &&
          confirmedValidationCount === validationTasks.length,
        validationTasks.length > 0 &&
          confirmedValidationCount < validationTasks.length,
      ),
      step(
        "更新批次结果",
        `${completedBatchIds.length} 个批次迁移完成`,
        completedBatchIds.length > 0,
      ),
    ],
  };

  const progress = Object.fromEntries(
    Object.entries(stageSteps).map(([id, steps]) => [
      id,
      s.enteredStages.includes(id as StageId)
        ? Math.round(
            (steps.filter((v) => v.state === "done").length / steps.length) *
              100,
          )
        : 0,
    ]),
  ) as Record<StageId, number>;
  return { stageSteps, progress };
}
