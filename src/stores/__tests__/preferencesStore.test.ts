import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaults, preferenceKeys } from "@/shared/preference-config";
import {
  preferencesStore,
  setPreference,
  startPreferenceSync,
} from "../preferencesStore";

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

let local: ReturnType<typeof storage>;
let other: ReturnType<typeof storage>;
let events: EventTarget;
let root: { lang: string; dataset: Record<string, string> };
let stop: (() => void) | undefined;

function changed(key: string | null, newValue: string | null, area = local) {
  const event = new Event("storage");
  Object.defineProperties(event, {
    key: { value: key },
    newValue: { value: newValue },
    storageArea: { value: area },
  });
  events.dispatchEvent(event);
}

beforeEach(() => {
  local = storage();
  other = storage();
  events = new EventTarget();
  root = { lang: "", dataset: {} };
  vi.stubGlobal("window", events);
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("localStorage", local);
  preferencesStore.setState({ ...defaults }, true);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shared appearance preferences", () => {
  it("hydrates only the three existing preference keys and mirrors them to the document", () => {
    local.values.set(preferenceKeys.theme, "dark");
    local.values.set(preferenceKeys.background, "mist");
    local.values.set(preferenceKeys.language, "en");
    local.values.set("account", "must-not-read");
    stop = startPreferenceSync();
    expect(preferencesStore.getState()).toEqual({
      theme: "dark",
      background: "mist",
      language: "en",
    });
    expect(root).toEqual({
      lang: "en",
      dataset: { theme: "dark", background: "mist" },
    });
    expect(local.getItem.mock.calls.map(([key]) => key)).toEqual(
      Object.values(preferenceKeys),
    );
    expect(local.setItem).not.toHaveBeenCalled();
  });

  it("persists only validated appearance values and never accepts a runtime credential key", () => {
    stop = startPreferenceSync();
    setPreference("theme", "teal");
    setPreference("background", "graphite");
    setPreference("language", "en");
    const malformed = setPreference as (key: string, value: string) => void;
    malformed("apiKey", "en");
    malformed("theme", "unrecognized");
    malformed("background", "https://example.test/private.png");
    expect(preferencesStore.getState()).toEqual({
      theme: "teal",
      background: "graphite",
      language: "en",
    });
    expect(local.setItem.mock.calls).toEqual([
      [preferenceKeys.theme, "teal"],
      [preferenceKeys.background, "graphite"],
      [preferenceKeys.language, "en"],
    ]);
    expect(root).toEqual({
      lang: "en",
      dataset: { theme: "teal", background: "graphite" },
    });
  });

  it("syncs another tab's local preference without echo-writing and ignores unrelated storage", () => {
    stop = startPreferenceSync();
    changed(preferenceKeys.theme, "burgundy");
    expect(preferencesStore.getState().theme).toBe("burgundy");
    expect(root.dataset.theme).toBe("burgundy");
    const current = preferencesStore.getState();
    changed(preferenceKeys.theme, "dark", other);
    changed("account", "en");
    expect(preferencesStore.getState()).toBe(current);
    expect(local.setItem).not.toHaveBeenCalled();
  });

  it("restores defaults for invalid, removed and cleared preference values", () => {
    local.values.set(preferenceKeys.theme, "invalid-theme");
    stop = startPreferenceSync();
    expect(preferencesStore.getState().theme).toBe(defaults.theme);
    setPreference("theme", "dark");
    setPreference("background", "mist");
    setPreference("language", "en");
    changed(preferenceKeys.theme, null);
    expect(preferencesStore.getState()).toEqual({
      ...defaults,
      background: "mist",
      language: "en",
    });
    changed(preferenceKeys.language, "unexpected");
    expect(preferencesStore.getState().language).toBe(defaults.language);
    changed(null, null);
    expect(preferencesStore.getState()).toEqual(defaults);
    expect(root).toEqual({
      lang: defaults.language,
      dataset: { theme: defaults.theme, background: defaults.background },
    });
  });

  it("keeps memory and document usable when browser storage is disabled", () => {
    local.getItem.mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    local.setItem.mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    stop = startPreferenceSync();
    expect(() => setPreference("theme", "dark")).not.toThrow();
    expect(preferencesStore.getState().theme).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
  });

  it("removes the cross-tab listener when the application preference bridge stops", () => {
    stop = startPreferenceSync();
    stop();
    stop = undefined;
    const current = preferencesStore.getState();
    changed(preferenceKeys.theme, "dark");
    expect(preferencesStore.getState()).toBe(current);
    expect(root.dataset.theme).toBe(defaults.theme);
  });
});
