import { preferencesStore, setPreference } from "@/stores/preferencesStore";
import type { Preferences } from "./preference-config";
export * from "./preference-config";
export function readPreference<K extends keyof Preferences>(
  key: K,
): Preferences[K] {
  return preferencesStore.getState()[key];
}
export const selectPreference = setPreference;
export function subscribePreferences(onChange: () => void) {
  return preferencesStore.subscribe(onChange);
}
