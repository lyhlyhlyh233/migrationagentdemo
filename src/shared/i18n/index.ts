import { useSyncExternalStore } from "react";
import { readPreference, subscribePreferences } from "../preferences";
import { localize } from "./text";
export { formatText, translateText } from "./text";
const translators = {
  "zh-CN": <T>(value: T, ...values: (string | number)[]): T =>
    localize(value, "zh-CN", values),
  en: <T>(value: T, ...values: (string | number)[]): T =>
    localize(value, "en", values),
};
export function useTranslation() {
  const language = useSyncExternalStore(
    subscribePreferences,
    () => readPreference("language"),
    () => "zh-CN" as const,
  );
  return translators[language];
}
