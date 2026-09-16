import { isTheme, themeStorageKey, type Theme } from "@/shared/theme-config";

export const backgrounds = [
  { id: "none", label: "纯色", image: null },
  {
    id: "architecture",
    label: "白色曲面",
    image: `${import.meta.env.BASE_URL}backgrounds/architecture.jpg`,
  },
  {
    id: "mist",
    label: "雾中远山",
    image: `${import.meta.env.BASE_URL}backgrounds/mist.jpg`,
  },
  {
    id: "graphite",
    label: "石墨波纹",
    image: `${import.meta.env.BASE_URL}backgrounds/graphite.jpg`,
  },
] as const;
export type Background = (typeof backgrounds)[number]["id"];
export type Language = "zh-CN" | "en";
export interface Preferences {
  theme: Theme;
  background: Background;
  language: Language;
}
export const defaults: Preferences = {
  theme: "white",
  background: "none",
  language: "zh-CN",
};
export const preferenceKeys = {
  theme: themeStorageKey,
  background: "migration-director-background",
  language: "migration-director-language",
};

export function validPreference<K extends keyof Preferences>(
  key: K,
  value: unknown,
): value is Preferences[K] {
  return key === "theme"
    ? isTheme(value)
    : key === "background"
      ? backgrounds.some((item) => item.id === value)
      : key === "language" && (value === "zh-CN" || value === "en");
}
