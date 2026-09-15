import type {
  ExecutionTaskKind,
  ProjectSnapshot,
  StageId,
} from "@/domain/models";
import { migrationScope } from "@/domain/assessment";
import { planningIsStale } from "@/domain/planning";
import { completedBatches } from "@/domain/policies";
import type { WorkStep } from "@/features/workspace/ExecutionInspector";
export function workspacePresentation(s: ProjectSnapshot) {
  const {
    risks,
    assessmentStatus,
    planningStatus,
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
  const planned = planningStatus === "completed" && !planningIsStale(s);
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
        "评估方案与迁移范围",
        assessed
          ? `可纳入 ${migrationScope(s).length} 台，风险可稍后处理`
          : "解读报告与推荐方案",
        assessed,
        false,
        false,
      ),
    ],
    planning: [
      step(
        "确认迁移范围",
        `${migrationScope(s).length} 台虚拟机`,
        Boolean(s.planning),
        planningStatus === "scope-review",
      ),
      step(
        "核对规划输入",
        "业务资料可选，缺失依赖持续标记",
        Boolean(s.planning?.revision) || planned,
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
        "受阻对象自动排除，人工确认交接",
        batchConfirmation === "confirmed",
        planned && batchConfirmation !== "confirmed",
        false,
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

  if (s.execution) {
    const e = s.execution,
      total = e.tasks.length;
    const cutover = e.tasks.filter((t) => t.phase === "validation").length;
    const passed = e.validations.filter((v) => v.business === "passed").length;
    stageSteps.migration = [
      step(
        "检测 Migration 连接",
        "连接配置与目标资源",
        e.connectionStatus === "ready",
        e.connectionStatus === "checking",
      ),
      step(
        "创建与全量同步",
        `${e.tasks.filter((t) => t.created).length} / ${total}`,
        total > 0 && e.tasks.every((t) => t.created),
        e.tasks.some((t) => ["creating", "full"].includes(t.phase)),
      ),
      step(
        "保持增量与人工割接",
        `${cutover} / ${total} 已割接`,
        total > 0 && cutover === total,
        e.tasks.some((t) =>
          ["incremental", "ready", "cutover"].includes(t.phase),
        ),
      ),
      step(
        "处理执行问题",
        `${e.issues.filter((i) => i.state !== "resolved").length} 项待处理`,
        total > 0 &&
          cutover === total &&
          e.issues.every((i) => i.state === "resolved"),
      ),
    ];
    stageSteps.validation = [
      step(
        "核对技术结果",
        `${e.validations.filter((v) => v.technical !== "different").length} / ${total}`,
        total > 0 &&
          e.validations.length === total &&
          e.validations.every((v) => v.technical !== "different"),
      ),
      step("业务验证", `${passed} / ${total}`, total > 0 && passed === total),
      step(
        "问题反馈与复查",
        `${e.feedback.filter((f) => f.status !== "resolved").length} 项待处理`,
        total > 0 &&
          passed === total &&
          e.feedback
            .filter((f) => f.blocking)
            .every((f) => f.status === "resolved"),
      ),
      step("确认最终交付", "阶段性结果持续更新", e.finalized),
    ];
  }
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
