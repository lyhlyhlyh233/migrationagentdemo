import { startPreferenceSync } from "@/stores/preferencesStore";
import "@/styles/index.css";
import "@/styles/tokens.css";
import { createRoot } from "react-dom/client";
import App from "./App";
const stopPreferences = startPreferenceSync();
if (import.meta.hot) import.meta.hot.dispose(stopPreferences);
createRoot(document.getElementById("root")!).render(<App />);
