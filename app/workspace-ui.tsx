'use client';

import { useEffect, useRef } from 'react';

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    edit: 'm15 5 4 4M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15v5Z',
    plus: 'M12 5v14M5 12h14', chat: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z',
    folder: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3V7Z',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h5',
    shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm0 5v5m0 3h.01',
    tasks: 'm3 6 2 2 4-4m-6 9 2 2 4-4m-6 9 2 2 4-4M12 6h9M12 13h9M12 20h9',
    sidebar: 'M3 4h18v16H3V4Zm6 0v16',
    panel: 'M3 4h18v16H3V4Zm12 0v16', menu: 'M4 6h16M4 12h16M4 18h16',
    chevron: 'm8 10 4 4 4-4', arrow: 'M12 19V5m-6 6 6-6 6 6', right: 'M5 12h14m-6-6 6 6-6 6',
    close: 'm6 6 12 12M6 18 18 6', check: 'm5 12 4 4L19 6', clock: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    download: 'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4', attach: 'm8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8',
    play: 'm8 5 11 7-11 7V5Z', agent: 'M6 8v8m0-4h8a4 4 0 0 0 4-4M4 4h4v4H4V4Zm0 12h4v4H4v-4Zm12-12h4v4h-4V4Z', brand: 'M4 4h9v9H4V4Zm7 11v5h9v-9h-5M8 8l8 8m-5 0h5v-5',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    refresh: 'M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9',
    info: 'M12 11v6m0-10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.file} /></svg>;
}

export type StepState = 'done' | 'active' | 'waiting' | 'blocked';
export interface WorkStep { label: string; detail: string; state: StepState }
export interface QuickGroup { label: string; icon: string; options: { label: string; description: string; onClick: () => void }[] }

export function ShortcutMenu({ groups }: { groups: QuickGroup[] }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && root.current?.contains(event.target as Node)) return;
      root.current?.querySelectorAll('details[open]').forEach((item) => item.removeAttribute('open'));
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', close); };
  }, []);
  return <div className="shortcut-groups" ref={root}>{groups.map((group) => <details key={group.label} name="stage-shortcuts" className="shortcut-menu"><summary><Icon name={group.icon} size={15} /><span>{group.label}</span><Icon name="chevron" size={13} /></summary><div className="shortcut-options">{group.options.map((option) => <button key={option.label} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); option.onClick(); }}><strong>{option.label}</strong><small>{option.description}</small></button>)}</div></details>)}</div>;
}

export function AgentPanel({ running, status, steps, stats, artifacts, events, onClose }: {
  running: boolean; status: string; steps: WorkStep[];
  stats: { label: string; value: string | number; tone?: string }[];
  artifacts: { label: string; meta: string; href?: string; download?: string; onClick?: () => void }[];
  events: { text: string; time: string }[]; onClose: () => void;
}) {
  const completed = steps.filter((step) => step.state === 'done').length;
  return <aside className="agent-inspector" data-running={running} aria-label="子智能体执行详情">
    <header className="inspector-header"><span>执行详情</span><button className="icon-button" aria-label="收起执行详情" onClick={onClose}><Icon name="panel" size={17} /></button></header>
    <div className="inspector-scroll">
      <div className={`state-label inspector-status ${running ? 'is-active' : ''}`}><Icon name="agent" size={16} /><span>{status}</span></div>
      <section className="inspector-section"><header><h3>执行步骤</h3><span>{completed} / {steps.length}</span></header><div className="step-overview" aria-hidden="true">{steps.map((step) => <span key={step.label} className={step.state} />)}</div><ol className="work-steps">{steps.map((step) => <li key={step.label} className={step.state}><span className="step-indicator">{step.state === 'done' ? <Icon name="check" size={12} /> : step.state === 'blocked' ? '!' : <i />}</span><div><strong>{step.label}</strong><p>{step.detail}</p></div></li>)}</ol></section>
      <section className="inspector-section"><header><h3>当前统计</h3><span>随任务更新</span></header><dl className="inspector-stats">{stats.map((stat) => <div key={stat.label} data-tone={stat.tone}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl></section>
      <section className="inspector-section"><header><h3>文件与产物</h3><span>{artifacts.length}</span></header>{artifacts.length ? <div className="artifact-list">{artifacts.map((item) => item.href ? <a href={item.href} download={item.download} key={item.label}><Icon name="file" /><span><strong>{item.label}</strong><small>{item.meta}</small></span><Icon name="download" size={15} /></a> : <button key={item.label} onClick={item.onClick}><Icon name="file" /><span><strong>{item.label}</strong><small>{item.meta}</small></span><Icon name="right" size={15} /></button>)}</div> : <p className="inspector-empty">完成当前步骤后，产物会保存在这里。</p>}</section>
      <section className="inspector-section activity-section"><header><h3>本会话活动</h3><Icon name="clock" size={14} /></header>{events.length ? events.slice(-3).reverse().map((event, index) => <div className="activity-event" key={`${index}-${event.text}`}><time>{event.time}</time><p>{event.text}</p></div>) : <p className="inspector-empty">等待开始当前任务。</p>}</section>
    </div>
  </aside>;
}
