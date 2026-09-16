import { createStore } from "zustand/vanilla";
import {
  defaults,
  preferenceKeys,
  validPreference,
  type Preferences,
} from "@/shared/preference-config";

export const preferencesStore = createStore<Preferences>(() => ({
  ...defaults,
}));
const keys = Object.keys(defaults) as (keyof Preferences)[];

function applyToDocument(values: Preferences) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = values.language;
  document.documentElement.dataset.theme = values.theme;
  document.documentElement.dataset.background = values.background;
}
export function setPreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K],
) {
  if (!keys.includes(key) || !validPreference(key, value)) return;
  const next = { ...preferencesStore.getState(), [key]: value };
  applyToDocument(next);
  preferencesStore.setState(next);
  try {
    localStorage.setItem(preferenceKeys[key], value);
  } catch {
    /* Memory remains usable. */
  }
}

/** Only visual preferences use browser storage. Preserve previous keys and cross-tab updates. */
export function startPreferenceSync() {
  const values = { ...defaults };
  for (const key of keys) {
    try {
      const saved = localStorage.getItem(preferenceKeys[key]);
      if (validPreference(key, saved)) Object.assign(values, { [key]: saved });
    } catch {
      /* Browser storage may be disabled. */
    }
  }
  applyToDocument(values);
  preferencesStore.setState(values);
  const onStorage = (event: StorageEvent) => {
    if (
      event.storageArea !== localStorage ||
      (event.key !== null &&
        !keys.some((key) => preferenceKeys[key] === event.key))
    )
      return;
    const next = { ...preferencesStore.getState() };
    for (const key of keys) {
      if (event.key === preferenceKeys[key] || event.key === null)
        Object.assign(next, {
          [key]: validPreference(key, event.newValue)
            ? event.newValue
            : defaults[key],
        });
    }
    applyToDocument(next);
    preferencesStore.setState(next);
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
