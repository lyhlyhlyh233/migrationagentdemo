import { ServiceError } from "./errors";
import { createHttpService } from "./http";
import { MockMigrationService } from "./mock";
export function createServices(
  mode = import.meta.env.VITE_SERVICE_MODE ?? "mock",
) {
  if (mode === "mock") return new MockMigrationService();
  if (mode === "http") return createHttpService();
  throw new ServiceError("NOT_CONFIGURED", `未知服务模式：${mode}`);
}
