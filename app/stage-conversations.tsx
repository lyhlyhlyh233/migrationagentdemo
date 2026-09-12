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
export const initialStageConversations = (): StageConversation[] => (['research', 'planning', 'migration', 'validation'] as StageId[]).map((stageId) => ({ id: mainConversationId(stageId), stageId, title: '阶段主会话', kind: 'main' }));

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
    <div className="nav-section-heading"><h2>{title}会话</h2><button className="icon-button" aria-label={`新建${title}子会话`} title="新建子会话" disabled={disabled} onClick={onCreate}><Icon name="plus" size={15} /></button></div>
    <nav className="stage-chat-list" aria-label={`${title}会话列表`}>
      {!disabled && conversations.map((chat) => editing === chat.id ? <form key={chat.id} className="chat-rename-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) { onRename(chat.id, name.trim()); setEditing(null); } }}>
        <input aria-label="会话名称" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoFocus onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setEditing(null); } }} />
        <button className="icon-button" type="submit" aria-label="保存会话名称" disabled={!name.trim()}><Icon name="check" size={14} /></button>
        <button className="icon-button" type="button" aria-label="取消重命名" onClick={() => setEditing(null)}><Icon name="close" size={14} /></button>
      </form> : <div key={chat.id} className={`stage-chat-row ${selectedId === chat.id ? 'selected' : ''}`}>
        <button className="stage-chat-link" title={chat.title} aria-current={selectedId === chat.id ? 'page' : undefined} onClick={() => onSelect(chat.id)}><Icon name={chat.kind === 'main' ? 'agent' : 'chat'} size={15} /><span>{chat.title}</span>{busyIds.includes(chat.id) && <span className="chat-busy" aria-label="正在处理"><Icon name="clock" size={12} /></span>}</button>
        {chat.kind === 'child' && <button className="icon-button rename-chat" aria-label={`重命名${chat.title}`} title="重命名" onClick={() => { setEditing(chat.id); setName(chat.title); }}><Icon name="edit" size={13} /></button>}
      </div>)}
    </nav>
    {disabled && <p className="nav-empty">创建项目后开启阶段会话</p>}
  </section>;
}
