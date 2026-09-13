'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { ThemePicker } from './theme-picker';
import { Icon } from './workspace-ui';
import { backgrounds, readPreference, selectPreference, subscribePreferences, type Language } from './preferences';
import { useTranslation } from './i18n';

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const t = useTranslation();
  const background = useSyncExternalStore(subscribePreferences, () => readPreference('background'), () => 'none' as const);
  const language = useSyncExternalStore(subscribePreferences, () => readPreference('language'), () => 'zh-CN' as const);
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) {
      element?.showModal();
      if (body.current) body.current.scrollTop = 0;
    }
    if (!open && element?.open) element.close();
  }, [open]);

  return <dialog ref={dialog} className="settings-modal" aria-labelledby="settings-title" onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => {
    if (event.key === 'Escape') event.stopPropagation();
    if (event.key !== 'Tab') return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)');
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="settings-drawer">
      <header className="settings-header"><h2 id="settings-title">{t('设置')}</h2><button className="icon-button" aria-label={t('关闭设置')} title={t('关闭设置')} onClick={onClose}><Icon name="close" size={20} /></button></header>
      <div className="settings-body" ref={body}>
        <section className="settings-section" aria-labelledby="appearance-title"><h3 id="appearance-title">{t('外观')}</h3><ThemePicker /></section>
        <section className="settings-section" aria-labelledby="background-title"><div className="settings-section-heading"><h3 id="background-title">{t('背景')}</h3><span>{t('整个工作台')}</span></div>
          <div className="background-picker" role="group" aria-label={t('背景')}>
            {backgrounds.map((item) => <button key={item.id} className="background-option" aria-label={t(`${item.label}背景`)} aria-pressed={background === item.id} onClick={() => selectPreference('background', item.id)}>
              <span className={`background-preview background-preview-${item.id}`} style={item.image ? { backgroundImage: `url("${item.image}")` } : undefined} aria-hidden="true">{!item.image && <Icon name="minus" size={24} />}{background === item.id && <span className="background-selected"><Icon name="check" size={13} /></span>}</span>
              <span>{t(item.label)}</span>
            </button>)}
          </div>
        </section>
        <section className="settings-section language-setting" aria-labelledby="language-title"><div><h3 id="language-title">{t('语言')}</h3><p>{t('更改界面语言，保留项目与对话原文。')}</p></div><select aria-labelledby="language-title" value={language} onChange={(event) => selectPreference('language', event.target.value as Language)}><option value="zh-CN">简体中文</option><option value="en">English</option></select></section>
      </div>
      <footer className="settings-footer"><Icon name="check" size={14} /><span>{t('偏好自动保存在此浏览器')}</span></footer>
    </div>
  </dialog>;
}
