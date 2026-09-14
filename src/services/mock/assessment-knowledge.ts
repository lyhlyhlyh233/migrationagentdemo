import type {
  BusinessResult,
  ProjectSnapshot,
  RiskItem,
} from "@/domain/models";
import {
  assessmentCounts,
  assessmentRisks,
  migrationScope,
} from "@/domain/assessment";

// Based on the supplied evaluation report templates and rule checklist.
// These findings demonstrate interactions; uploaded workbooks are not evaluated by Mock.
export function buildAssessmentRisks(s: ProjectSnapshot): RiskItem[] {
  const definitions: Omit<
    RiskItem,
    | "id"
    | "stage"
    | "batchId"
    | "vmName"
    | "vmId"
    | "closed"
    | "closedAt"
    | "closureDescription"
  >[] = [
    {
      description: "源端与目标端 CPU 架构不兼容",
      category: "compatibility",
      impact: "blocked",
      level: "high",
      rule: "CPU 架构检查 · 规则 3",
      evidence: "示例：源端 x86，拟用目标资源池为 ARM。",
      recommendation:
        "从本次工具迁移中排除，另行评估应用重建；或改用同架构资源池并重新评估。",
      recommendedStrategy: "exclude",
      recommendedMethod: "manual",
    },
    {
      description: "GuestOS 详细版本缺失",
      category: "compatibility",
      impact: "change",
      level: "high",
      rule: "GuestOS 兼容性检查 · 规则 1",
      evidence: "示例：Guest Detailed Data 为空，配置中的 OS 为 Other Linux。",
      recommendation:
        "补采详细版本，核对 MD 与 FusionCompute 两份兼容性列表后再迁移。",
      recommendedStrategy: "remediate",
      recommendedMethod: "agentless",
    },
    {
      description: "物理兼容模式 RDM 磁盘限制免代理迁移",
      category: "disk",
      impact: "change",
      level: "medium",
      rule: "RDM 盘检查 · 规则 11",
      evidence: "示例：vDisk 的 RAW 为 True，兼容模式为 physicalMode。",
      recommendation:
        "优先验证有代理方案；若坚持免代理，需修改兼容模式或解挂磁盘并验证业务。",
      recommendedStrategy: "remediate",
      recommendedMethod: "agent",
    },
    {
      description: "独立持久磁盘无法通过免代理同步",
      category: "disk",
      impact: "change",
      level: "medium",
      rule: "磁盘模式检查 · 规则 12",
      evidence: "示例：Disk Mode 为 independent_persistent。",
      recommendation:
        "修改为支持的磁盘模式，或验证有代理方案；变更前确认一致性与回退。",
      recommendedStrategy: "remediate",
      recommendedMethod: "agent",
    },
    {
      description: "现有快照数量影响迁移效率",
      category: "disk",
      impact: "constraint",
      level: "low",
      rule: "快照数量检查 · 规则 15",
      evidence: "示例：vSnapshot 中存在 6 个非迁移工具创建的快照。",
      recommendation:
        "建议合并快照；若暂时保留，记录同步时长与可用空间的约束。",
      recommendedStrategy: "ignore",
      recommendedMethod: "agentless",
    },
    {
      description: "F5 虚拟设备不支持工具迁移",
      category: "application",
      impact: "blocked",
      level: "high",
      rule: "应用评估 · 黑名单",
      evidence: "示例：应用调研表包含 F5 负载均衡虚拟设备。",
      recommendation:
        "不纳入工具迁移，联系应用方制定目标端重建与配置恢复方案。",
      recommendedStrategy: "exclude",
      recommendedMethod: "manual",
    },
    {
      description: "Kubernetes 应用需要专项验证",
      category: "application",
      impact: "change",
      level: "medium",
      rule: "应用评估 · 灰名单",
      evidence: "示例：应用调研表登记 Kubernetes，缺少存储插件与网络插件信息。",
      recommendation:
        "补齐组件版本与持久卷信息，先做隔离环境验证，再确定批次。",
      recommendedStrategy: "remediate",
      recommendedMethod: "agentless",
    },
    {
      description: "目标集群资源预留不足",
      category: "capacity",
      impact: "change",
      level: "high",
      rule: "目标平台计算与存储资源评估",
      evidence: "示例：目标集群预留余量低于 10%，容量复核尚未完成。",
      recommendation:
        "按 CPU 超分比及 90% 使用上限复核；扩容或调整资源池后再纳入实施。",
      recommendedStrategy: "remediate",
      recommendedMethod: "agentless",
    },
    {
      description: "SR-IOV 网卡需要目标端重新配置",
      category: "specification",
      impact: "change",
      level: "medium",
      rule: "SR-IOV 直通卡检查 · 规则 16",
      evidence: "示例：vNetwork 的 Adapter 为 VirtualSriovEthernetCard。",
      recommendation:
        "改用常规网卡并验证网络，或明确目标端手动配置直通网卡的方案。",
      recommendedStrategy: "remediate",
      recommendedMethod: "agentless",
    },
    {
      description: "源端 DRS 开启，需使用 vCenter 账户",
      category: "feature",
      impact: "constraint",
      level: "medium",
      rule: "源端集群 DRS 状态检查",
      evidence: "示例：源端集群开启 DRS，虚拟机可能漂移至其他 ESXi。",
      recommendation: "使用 vCenter 账户接入，保留漂移检查与任务异常处理约束。",
      recommendedStrategy: "ignore",
      recommendedMethod: "agentless",
    },
    {
      description: "目标端 RAID 卡兼容性待核实",
      category: "hardware",
      impact: "change",
      level: "high",
      rule: "目标端硬件兼容性 · RAID 卡",
      evidence: "示例：目标端 RAID 固件版本未提供，尚不能匹配对应版本 HCL。",
      recommendation:
        "补齐设备型号、驱动和固件版本，确认兼容或更换设备后再迁移。",
      recommendedStrategy: "remediate",
      recommendedMethod: "agentless",
    },
  ];
  return definitions.map((risk, index) => ({
    ...risk,
    id: 101 + index,
    stage: "research",
    batchId: "—",
    vmName: String(
      s.scopeRows[index === 9 ? 4 : index]?.[0] ?? `VM-${index + 1}`,
    ),
    vmId: `VMID-${1001 + (index === 9 ? 4 : index)}`,
    closed: false,
    closedAt: "—",
    closureDescription: "",
  }));
}
export const assessmentWelcome =
  "我会先判断哪些虚拟机适合免代理迁移、哪些需要调整方案，以及哪些暂时不能迁。评估依据包括源端配置、目标平台兼容性、应用要求和资源容量。\n\n请提供两份资料：\n\n- **RVTools 采集表**：建议使用 4.7.1 或以上版本，包含虚拟机、磁盘、网络、快照和主机信息。\n- **迁移调研表**：补充目标平台版本与 CPU 架构、应用清单、目标硬件和容量。\n\n收到资料后，我会解释报告中的关键发现，再与你一起确定迁移方案和处置策略。当前为前端模拟，可使用示例资料查看效果。";
export function assessmentReportReply(
  s: ProjectSnapshot,
  question = "",
): { text: string; results: BusinessResult[] } {
  const n = assessmentCounts(s);
  const risks = assessmentRisks(s);
  const summary: BusinessResult = {
    kind: "summary",
    title: "评估结论快照",
    stageId: "research",
    metrics: [
      { label: "评估虚拟机", value: n.total },
      { label: "按现状可迁", value: n.direct, tone: "success" },
      { label: "需调整或验证", value: n.changed, tone: "warning" },
      { label: "当前方案不支持", value: n.blocked, tone: "danger" },
    ],
    detail:
      "按虚拟机去重，阻塞优先于整改；迁移约束仍需记录。此处为示例评估结果。",
  };
  const results: BusinessResult[] = [];
  if (/RDM|磁盘|代理|agent|disk/i.test(question))
    return {
      text: "**不支持免代理，不等于所有方案都不能迁。**\n\n物理模式 RDM、独立持久磁盘、共享 SCSI 或共享磁盘，会限制依赖快照的免代理方案。根据你提供的评估规则，可以考虑有代理迁移，或调整磁盘配置后重新评估。\n\n建议先对相关虚拟机做有代理验证，确认应用一致性、停机窗口和回退条件。选择“整改后迁移”会保留待验证状态，不能直接作为已具备实施条件。你可以在风险抽屉中按“磁盘与快照”统一选择策略。",
      results,
    };
  if (/应用|F5|Kubernetes|application/i.test(question))
    return {
      text: "**应用能否迁移，需要与虚拟机配置分开判断。**\n\n提供的规则把 Kubernetes、OpenShift 列为灰名单，需要补采组件、网络和存储信息并进行专项验证。F5 等虚拟设备在规则中不支持工具迁移，适合从本次工具范围排除，另行制定目标端重建方案。\n\n建议由应用负责人确认验证标准与回退方式。选择“不迁”只影响本次工具范围；选择“自定义策略”可以记录另行重建的实施安排。",
      results,
    };
  if (/容量|资源|CPU|架构|capacity|resource|architecture/i.test(question))
    return {
      text: "**先确认架构兼容，再核算可用容量。**\n\n规则要求源端与目标端 CPU 架构满足支持关系，跨架构不能因接受风险就直接使用工具迁移。容量需要按目标集群分别核算；资料中的默认 CPU 超分比为 3，并预留 10% 资源余量。\n\n建议先补齐目标硬件型号、驱动和固件版本，再对照对应版本兼容性清单。容量不足可扩容或调整资源池；这些变更在实施前都应留下复核依据。",
      results,
    };
  const undecided = n.undecided;
  return {
    text: `**评估结论：建议采用混合迁移方案，先安排可迁对象试点，受阻对象另行处理。**\n\n本次示例评估覆盖 ${n.total} 台虚拟机：${n.direct} 台按现状可迁，${n.changed} 台需要调整或验证，${n.blocked} 台当前方案不支持。这是按虚拟机去重的分类，不能把 ${risks.length} 条风险直接当成受影响虚拟机数量。\n\n- **可迁部分**：优先免代理迁移，同时把 DRS、快照等约束带入实施计划。\n- **需要变化的部分**：RDM、磁盘模式、应用与资源问题应分别选择有代理验证、配置整改或扩容。\n- **当前不支持的部分**：跨架构和不支持的虚拟设备，建议从工具范围排除或另行重建。\n\n${undecided ? `目前还有 ${undecided} 条风险未选择策略。可以按类别处理，也可以直接继续规划；受阻且未完成验证的对象会自动排除。` : `风险处置方案已记录，当前工具迁移范围为 ${migrationScope(s).length} 台。未完成整改验证的对象仍不进入工具范围，确认交接即可继续。`}\n\n你也可以继续问我：“为什么这些磁盘要改用有代理？”或“应用重建会影响哪些安排？”`,
    results: [
      summary,
      ...(!question || /方案|strategy|plan/i.test(question)
        ? [{ kind: "assessment-decision" as const }]
        : []),
      { kind: "artifacts", artifactIds: ["assessment-report"] },
    ],
  };
}
