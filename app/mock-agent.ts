import type { AgentRun, ApprovalRequest, ConversationMessage, MigrationPhaseId } from './types';

export interface AgentService {
  sendMessage(input: string, phase: MigrationPhaseId): Promise<ConversationMessage>;
  controlRun(action: 'pause' | 'resume' | 'stop', run: AgentRun): Promise<AgentRun>;
  resolveApproval(request: ApprovalRequest, action: 'approve' | 'reject' | 'changes', note: string): Promise<ApprovalRequest>;
}

const now = () => new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const phaseReplies: Record<MigrationPhaseId, string> = {
  assessment: '我已重新汇总仓库扫描结果。当前 3 个主要风险集中在 Java EE 命名空间、Spring Security 配置和数据库方言，建议先锁定兼容性基线。',
  planning: '已结合依赖关系更新迁移计划。建议保持四个工作包，并将数据库变更从 Wave 2 拆分为独立审批节点，以降低回滚复杂度。',
  implementation: '已收到指令。我会在隔离分支继续执行，并同步更新文件变更、测试结果与审计记录；遇到不可逆操作会自动暂停。',
  validation: '我已整理最新验证结果。当前单元测试通过率 98.7%，仍有 2 项认证回归失败，需要在进入最终验收前关闭。',
};

export const mockAgentService: AgentService = {
  async sendMessage(input, phase) {
    await wait(850);
    const asksRisk = /风险|失败|异常|为什么/.test(input);
    const asksReport = /报告|汇总|总结/.test(input);
    const content = asksRisk
      ? '当前最高风险是 refresh_token 表的索引重建：生产数据量约 1,280 万行，在线执行可能造成短暂锁表。我已准备影子表迁移与回滚脚本，等待你的审批。'
      : asksReport
        ? '阶段报告已生成：18/24 项任务完成，47 个文件发生变更，单元测试通过率 98.7%。数据库迁移仍处于审批等待状态。'
        : phaseReplies[phase];

    return { id: `agent-${Date.now()}`, role: 'agent', content, time: now() };
  },

  async controlRun(action, run) {
    await wait(220);
    return { ...run, status: action === 'pause' ? 'paused' : action === 'resume' ? 'running' : 'stopped' };
  },

  async resolveApproval(request, action) {
    await wait(320);
    const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes-requested';
    return { ...request, status };
  },
};
