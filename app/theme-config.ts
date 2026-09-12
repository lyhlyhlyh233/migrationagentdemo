export const themes = [
  { id: 'white', label: '白色' },
  { id: 'teal', label: '青绿' },
  { id: 'burgundy', label: '酒红' },
  { id: 'dark', label: '深色' },
] as const;

export type Theme = (typeof themes)[number]['id'];
export const themeStorageKey = 'migration-director-theme';
export const isTheme = (value: unknown): value is Theme => themes.some((theme) => theme.id === value);

// Apply the saved appearance before the first paint. Only known theme IDs reach the DOM.
export const themeBootstrap = `(() => { let theme = 'white'; try { const saved = localStorage.getItem(${JSON.stringify(themeStorageKey)}); if (${JSON.stringify(themes.map(({ id }) => id))}.includes(saved)) theme = saved; } catch {} document.documentElement.dataset.theme = theme; })();`;
