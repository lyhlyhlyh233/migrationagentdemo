import type { ConversationAgentId } from "@/domain/models";
const discussionReplies = {
  general:
    "可以。先告诉我你要迁移什么，以及当前最需要解决的问题。\n\n- **迁移范围**：源端和目标端是什么平台，大约有多少资产？\n- **业务约束**：允许停机多久，是否有优先迁移的业务？\n- **预期结果**：你想先做可行性评估，还是已经准备制定计划？\n\n不需要一次补齐所有信息，我们可以从你最确定的部分开始。",
  research:
    "建议先准备 **资产清单** 和 **业务约束**，用它们建立评估基线。\n\n- **资产清单**：核对虚拟机、操作系统、CPU、内存、磁盘和网络配置。\n- **业务约束**：明确高峰时段、允许停机窗口和关键系统依赖。\n- **兼容性**：重点确认源端与目标端的版本、驱动和存储支持情况。\n\n可以先提供源端平台和资产数量，我再帮你梳理需要补充的资料。",
  planning:
    "建议按 **试点 → 核心业务 → 扩展批次** 安排迁移，先验证方案，再逐步扩大范围。\n\n1. **试点批次**：选择依赖少、影响可控的业务，验证迁移和回退流程。\n2. **核心业务**：按业务依赖划分批次，分别确认停机窗口和负责人。\n3. **扩展批次**：复用试点结论，根据资源容量和执行窗口调整节奏。\n\n每个批次都应明确验收标准与回退条件，避免只排日期而遗漏业务依赖。",
  migration:
    "实施前，建议先确认 **批次范围、目标配置和割接窗口**。\n\n- **同步阶段**：关注同步进度、失败任务和目标端资源余量。\n- **割接前**：完成增量追平、业务停写确认，并核对回退准备。\n- **割接后**：检查业务访问、数据完整性和关键监控指标。\n\n关键执行操作需要人工确认；出现异常时，优先依据预先约定的回退条件处理。",
  validation:
    "验收建议覆盖 **配置、数据和业务** 三个方面。\n\n- **配置一致性**：核对 CPU、内存、磁盘、网络与系统设置。\n- **数据完整性**：确认关键数据、权限和文件数量符合预期。\n- **业务可用性**：由业务负责人验证核心交易或访问链路。\n\n将差异、处理结果和验证证据一并记录，全部确认后再完成交付。",
  risk: "建议优先确认这三类风险：\n\n- **停机窗口**：迁移和验证能否在允许的业务窗口内完成？\n- **平台兼容**：操作系统、驱动、网络与存储配置是否适配目标端？\n- **回退条件**：出现异常时，能否恢复源端业务并确认数据边界？\n\n你可以先补充源端和目标端平台，我再帮你把风险细化为可核对的清单。",
} as const;

export function previewDiscussionReply(
  text: string,
  agent: ConversationAgentId,
) {
  if (/风险|兼容|risk|compatib/i.test(text)) return discussionReplies.risk;
  if (agent !== "general")
    return discussionReplies[agent as keyof typeof discussionReplies];
  if (/规划|计划|批次|plan|batch/i.test(text))
    return discussionReplies.planning;
  if (/验收|验证|核验|validat|acceptance/i.test(text))
    return discussionReplies.validation;
  if (/实施|割接|同步|cutover|sync/i.test(text))
    return discussionReplies.migration;
  if (/评估|资料|清单|assess|input|file/i.test(text))
    return discussionReplies.research;
  return discussionReplies.general;
}

// Authored preview summaries describe the response focus, not private model reasoning.
export function previewThoughtSummary(
  text: string,
  agent: ConversationAgentId,
) {
  if (/风险|兼容|risk|compatib/i.test(text))
    return "本轮围绕业务连续性展开，重点归纳停机窗口、平台兼容与回退保障。";
  if (agent === "planning" || /规划|计划|批次|plan|batch/i.test(text))
    return "本轮结合业务依赖、资源容量和迁移窗口，整理分批推进的建议。";
  if (agent === "validation" || /验收|验证|validat|acceptance/i.test(text))
    return "本轮从配置一致性、数据完整性和业务可用性三个方面整理验收重点。";
  if (agent === "migration" || /实施|割接|同步|cutover|sync/i.test(text))
    return "本轮重点是实施准备、异常处理与人工确认，建议按现有阶段条件推进。";
  return "本轮先结合问题和已有项目上下文，梳理需要确认的信息与可执行的下一步。";
}
