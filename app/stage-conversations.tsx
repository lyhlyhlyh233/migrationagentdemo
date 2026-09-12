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
        <button className="stage-chat-link" title={chat.title} aria-current={selectedId === chat.id ? 'page' : undefined} onClick={() => onSelect(chat.id)}><Icon name={chat.kind === 'main' ? 'agent' : 'chat'} size={15} /><span className="delivery-chat-title">{chat.title}<small>{chat.kind === 'main' && chat.title === stageTitles[chat.stageId] ? '阶段启动时创建' : stageTitles[chat.stageId]}</small></span>{busyIds.includes(chat.id) && <span className="chat-busy" aria-label="正在处理"><Icon name="clock" size={12} /></span>}</button>
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
