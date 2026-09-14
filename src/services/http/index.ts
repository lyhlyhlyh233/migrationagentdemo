import type { MigrationService } from "../contracts";
import { ServiceError } from "../errors";
// Implement these capability methods against your internal API. No endpoint is guessed.
// Wire DTO decoding through client.ts, and map progress/stream events into ServiceEvent.
// baseUrl is supplied by app/config.ts. Use it with createHttpClient when routes are agreed.
// Receiving a base URL alone does not enable an unimplemented backend.
export function createHttpService(_config: {
  baseUrl: string;
}): MigrationService {
  const missing = async (): Promise<never> => {
    throw new ServiceError(
      "NOT_CONFIGURED",
      "后端接口尚未接入，请配置服务适配器。",
    );
  };
  return {
    catalog: missing,
    listProjects: missing,
    createProject: missing,
    getProject: missing,
    createConversation: missing,
    renameConversation: missing,
    sendMessage: missing,
    execute: missing,
    upload: missing,
    download: missing,
    getAccount: missing,
    configureAccount: missing,
    logout: missing,
    subscribe: () => () => {},
    dispose: () => {},
  };
}
