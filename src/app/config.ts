import type { ServiceConfig } from "@/services";

// Vite environment values are read only at the application composition boundary.
export const serviceConfig: ServiceConfig = {
  mode: import.meta.env.VITE_SERVICE_MODE ?? "mock",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
};
