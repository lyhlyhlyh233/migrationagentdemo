'use client';

import { useState } from 'react';
import { Icon } from './workspace-ui';

export type StageId = 'research' | 'planning' | 'migration' | 'validation';
export interface StageConversation {
  id: string;
  stageId: StageId;
  title: string;
  kind: 'main' | 'child';
  manuallyNamed?: boolean;
}
export const mainConversationId = (stageId: StageId) => `stage-${stageId}-main`;
export const stageTitles: Record<StageId, string> = { research: '调研评估', planning: '规划设计', migration: '迁移实施', validation: '结果验证' };
const stageLabels: Record<StageId, string> = { research: '评估', planning: '规划', migration: '实施', validation: '验证' };
export const createStageConversation = (stageId: StageId): StageConversation => ({ id: mainConversationId(stageId), stageId, title: stageTitles[stageId], kind: 'main' });
export const initialStageConversations = (): StageConversation[] => [createStageConversation('research')];

export function StageConversationList({ title, conversations, selectedId, disabled, busyIds, onCreate, onSelect, onRename }: {
  title: string;
  conversations: StageConversation[];
  selectedId: string | null;
  disabled: boolean;
  busyIds: string[];
  onCreate: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  return <section className="nav-section nav-delivery">
    <div className="nav-section-heading"><h2>四阶交付会话</h2><button className="icon-button" aria-label="新建交付会话" title={`新建${title}会话`} disabled={disabled} onClick={onCreate}><Icon name="plus" size={15} /></button></div>
    <nav className="stage-chat-list" aria-label="四阶交付会话列表">
      {!disabled && conversations.map((chat) => editing === chat.id ? <form key={chat.id} className="chat-rename-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) { onRename(chat.id, name.trim()); setEditing(null); } }}>
        <input aria-label="会话名称" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoFocus onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setEditing(null); } }} />
        <button className="icon-button" type="submit" aria-label="保存会话名称" disabled={!name.trim()}><Icon name="check" size={14} /></button>
        <button className="icon-button" type="button" aria-label="取消重命名" onClick={() => setEditing(null)}><Icon name="close" size={14} /></button>
      </form> : <div key={chat.id} className={`stage-chat-row ${selectedId === chat.id ? 'selected' : ''}`}>
        <button className="stage-chat-link" title={`${chat.title} · ${stageTitles[chat.stageId]}${chat.kind === 'main' ? ' · 阶段启动时创建' : ''}`} aria-current={selectedId === chat.id ? 'page' : undefined} onClick={() => onSelect(chat.id)}><Icon name={chat.kind === 'main' ? 'agent' : 'chat'} size={15} /><span className="delivery-chat-title">{chat.title}</span>{chat.title !== stageTitles[chat.stageId] && <small className="delivery-chat-stage" aria-label={stageTitles[chat.stageId]}>{stageLabels[chat.stageId]}</small>}{busyIds.includes(chat.id) && <span className="chat-busy" aria-label="正在处理"><Icon name="clock" size={12} /></span>}</button>
        <button className="icon-button rename-chat" aria-label={`重命名${chat.title}`} title="重命名" onClick={() => { setEditing(chat.id); setName(chat.title); }}><Icon name="edit" size={13} /></button>
      </div>)}
    </nav>
    {disabled && <p className="nav-empty">创建项目后开启阶段会话</p>}
  </section>;
}

export function StageHandoff({ from, to, checks, reviewing, onReview, onCancel, onConfirm }: {
  from: string; to: string; checks: string[]; reviewing: boolean;
  onReview: () => void; onCancel: () => void; onConfirm: () => void;
}) {
  return <section className="stage-handoff" aria-label="阶段交接确认">
    <div className="stage-handoff-summary"><Icon name="check" size={17} /><div><strong>{from}已满足交接条件</strong><p>人工确认后开启{to}会话。</p></div>{!reviewing && <button onClick={onReview}>查看交接<Icon name="right" size={14} /></button>}</div>
    {reviewing && <div className="stage-handoff-review"><ul>{checks.map((check) => <li key={check}><Icon name="check" size={13} />{check}</li>)}</ul><p>确认后，系统会保留现有记录，并创建新的{to}会话。</p><div><button onClick={onCancel}>暂不进入</button><button className="primary" onClick={onConfirm}>确认进入{to}</button></div></div>}
  </section>;
}


export function StageFlowPreview({ hasProject, ready, onOpenAssessment }: { hasProject: boolean; ready: boolean; onOpenAssessment: () => void }) {
  const descriptions: Record<StageId, string> = { research: '梳理资产与风险', planning: '制定批次与方案', migration: '执行迁移与割接', validation: '核验结果与交付' };
  const icons: Record<StageId, string> = { research: 'search', planning: 'file', migration: 'tasks', validation: 'check' };
  return <section className="progress-rail stage-flow-preview" aria-label="四阶交付流程预览">
    <div className="progress-caption"><span>四阶交付</span><span>{hasProject ? ready ? '资料已就绪，等待启动评估' : '从准备评估资料开始' : '创建项目后开启'}</span></div>
    <ol>{(Object.keys(stageTitles) as StageId[]).map((stageId, index) => <li key={stageId} className={hasProject && stageId === 'research' ? 'preview-current' : ''}>
      <button disabled={!hasProject || stageId !== 'research'} onClick={onOpenAssessment} aria-current={hasProject && stageId === 'research' ? 'step' : undefined}>
        <span className="preview-stage-icon"><Icon name={icons[stageId]} size={17} /></span>
        <span className="preview-stage-copy"><strong>{stageTitles[stageId]}</strong><span>{descriptions[stageId]}</span></span>
      </button>
      {index < 3 && <span className="preview-stage-next" aria-hidden="true"><Icon name="right" size={14} /></span>}
    </li>)}</ol>
  </section>;
}
