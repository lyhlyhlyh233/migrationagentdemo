export const themes = [
  { id: 'white', label: '白色' },
  { id: 'dark', label: '深色' },
  { id: 'teal', label: '青绿' },
  { id: 'burgundy', label: '酒红' },
] as const;

export type Theme = (typeof themes)[number]['id'];
export const themeStorageKey = 'migration-director-theme';
export const isTheme = (value: unknown): value is Theme => themes.some((theme) => theme.id === value);
