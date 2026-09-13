import { isTheme, themeStorageKey, type Theme } from './theme-config';

export const backgrounds = [
  { id: 'none', label: '纯色', image: null },
  { id: 'architecture', label: '白色曲面', image: '/backgrounds/architecture.jpg' },
  { id: 'mist', label: '雾中远山', image: '/backgrounds/mist.jpg' },
  { id: 'graphite', label: '石墨波纹', image: '/backgrounds/graphite.jpg' },
] as const;
export type Background = typeof backgrounds[number]['id'];
export type Language = 'zh-CN' | 'en';
export interface Preferences { theme: Theme; background: Background; language: Language }
export const defaults: Preferences = { theme: 'white', background: 'none', language: 'zh-CN' };
export const preferenceKeys = { theme: themeStorageKey, background: 'migration-director-background', language: 'migration-director-language' };
export const preferenceEvent = 'migration-preferences-change';

export function validPreference<K extends keyof Preferences>(key: K, value: unknown): value is Preferences[K] {
  return key === 'theme' ? isTheme(value) : key === 'background' ? backgrounds.some((item) => item.id === value) : value === 'zh-CN' || value === 'en';
}

export function readPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  const root = document.documentElement;
  const value = key === 'language' ? root.lang : root.dataset[key];
  return validPreference(key, value) ? value : defaults[key];
}

function applyPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  if (key === 'language') document.documentElement.lang = value;
  else document.documentElement.dataset[key] = value;
}

export function selectPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  applyPreference(key, value);
  try { localStorage.setItem(preferenceKeys[key], value); } catch { /* Keep settings usable without browser storage. */ }
  window.dispatchEvent(new Event(preferenceEvent));
}

export function subscribePreferences(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    for (const key of Object.keys(defaults) as (keyof Preferences)[]) {
      if (event.key === preferenceKeys[key] || event.key === null) {
        applyPreference(key, validPreference(key, event.newValue) ? event.newValue : defaults[key]);
      }
    }
    onChange();
  }
  window.addEventListener(preferenceEvent, onChange);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(preferenceEvent, onChange); window.removeEventListener('storage', onStorage); };
}

// Restore known values before paint; never interpolate a stored URL into CSS.
export const preferencesBootstrap = `(() => { const choices = ${JSON.stringify({ theme: ['white', 'dark', 'teal', 'burgundy'], background: backgrounds.map((item) => item.id), language: ['zh-CN', 'en'] })}; const defaults = ${JSON.stringify(defaults)}; const keys = ${JSON.stringify(preferenceKeys)}; for (const key of Object.keys(defaults)) { let value = defaults[key]; try { const saved = localStorage.getItem(keys[key]); if (choices[key].includes(saved)) value = saved; } catch {} if (key === 'language') document.documentElement.lang = value; else document.documentElement.dataset[key] = value; } })();`;
