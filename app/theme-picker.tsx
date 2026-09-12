'use client';

import { useSyncExternalStore } from 'react';
import { isTheme, themes, themeStorageKey, type Theme } from './theme-config';

const changeEvent = 'migration-theme-change';

function getTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return isTheme(value) ? value : 'white';
}

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== themeStorageKey && event.key !== null) return;
    document.documentElement.dataset.theme = isTheme(event.newValue) ? event.newValue : 'white';
    onChange();
  }
  window.addEventListener(changeEvent, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function selectTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(themeStorageKey, theme); } catch { /* Appearance still works when storage is unavailable. */ }
  window.dispatchEvent(new Event(changeEvent));
}

export function ThemePicker() {
  const selected = useSyncExternalStore(subscribe, getTheme, () => 'white' as const);
  return <div className="theme-picker" role="group" aria-label="界面样式">
    {themes.map((theme) => <button key={theme.id} type="button" aria-pressed={selected === theme.id} aria-label={`${theme.label}样式`} title={`${theme.label}样式`} onClick={() => selectTheme(theme.id)}>
      <span className={`theme-swatch swatch-${theme.id}`} aria-hidden="true" />{theme.label}
    </button>)}
  </div>;
}
