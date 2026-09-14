import {
  defaults,
  preferenceKeys,
  validPreference,
} from "@/shared/preferences";
import "@/styles/index.css";
import "@/styles/tokens.css";
import { createRoot } from "react-dom/client";
import App from "./App";
for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
  let value = defaults[key];
  try {
    const stored = localStorage.getItem(preferenceKeys[key]);
    if (validPreference(key, stored)) value = stored;
  } catch {
    /* Preferences remain usable without storage. */
  }
  if (key === "language") document.documentElement.lang = value;
  else document.documentElement.dataset[key] = value;
}
createRoot(document.getElementById("root")!).render(<App />);
