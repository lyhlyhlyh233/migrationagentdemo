'use client';

import { useTranslation } from './i18n';
import { Select } from './select';
import { Icon } from './workspace-ui';

export const conversationAgents = [
  { id: 'general', label: '通用智能体' },
  { id: 'research', label: '评估智能体' },
  { id: 'planning', label: '规划智能体' },
  { id: 'migration', label: '实施智能体' },
  { id: 'validation', label: '验证智能体' },
] as const;
export type ConversationAgentId = typeof conversationAgents[number]['id'];

export const agentGuidance: Record<ConversationAgentId, string> = {
  general: '可以先补充源端平台、资产数量和业务约束，便于明确接下来的准备工作。',
  research: '评估时先梳理资产清单、资源容量与兼容性。请补充源端平台、资产数量和业务高峰时段，再核对需要优先处理的风险。',
  planning: '规划时先确认业务依赖、停机窗口和目标端资源。建议从小范围试点开始，为每个批次明确实施顺序、验证方式与回退条件。',
  migration: '实施前需要确认批次范围、配置与割接窗口。执行过程中重点关注同步进度、异常任务和回退条件，关键操作仍需人工确认。',
  validation: '验证时应对照源端与目标端配置，核对数据、网络和业务可用性。逐项记录差异与处理结果，再整理验收证据。',
};

export function ConversationAgentPicker({ value, onChange }: { value: ConversationAgentId; onChange: (value: ConversationAgentId) => void }) {
  const t = useTranslation();
  return <label className="composer-agent-picker"><Icon name="agent" size={15} /><span className="composer-select-control"><Select aria-label={t('切换对话智能体')} title={t(conversationAgents.find((agent) => agent.id === value)!.label)} value={value} onValueChange={(value) => {
    const agent = conversationAgents.find((item) => item.id === value);
    if (agent) onChange(agent.id);
  }}>{conversationAgents.map((agent) => <option key={agent.id} value={agent.id}>{t(agent.label)}</option>)}</Select></span></label>;
}
