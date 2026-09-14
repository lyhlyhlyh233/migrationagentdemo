import { ServiceError } from "./errors";
import { createHttpService } from "./http";
import { MockMigrationService } from "./mock";
import type { MigrationService } from "./contracts";

export interface ServiceConfig {
  mode: string;
  apiBaseUrl: string;
}

export function createServices({
  mode,
  apiBaseUrl,
}: ServiceConfig): MigrationService {
  if (mode === "mock") return new MockMigrationService();
  if (mode === "http") return createHttpService({ baseUrl: apiBaseUrl });
  throw new ServiceError("NOT_CONFIGURED", `未知服务模式：${mode}`);
}
