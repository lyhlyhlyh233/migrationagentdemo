import { EMPTY_WORKSPACE_ID } from "@/domain/models";
import type { MigrationService, ServiceEvent } from "@/services/contracts";
import { errorMessage } from "@/services/errors";
import type { WorkspaceStore } from "@/stores/workspaceStore";

/** Bridges service events to the public read model. It never changes the active conversation. */
export function connectWorkspace(
  store: WorkspaceStore,
  service: MigrationService,
) {
  let active = true;
  let controller: AbortController | undefined;
  function receive(event: ServiceEvent) {
    if (!active) return;
    const state = store.getState();
    if (event.type === "snapshot") {
      state.dispatchData({ type: "snapshot", snapshot: event.snapshot });
    } else {
      const message = event.type === "notice" ? event.text : event.message;
      if (event.conversationId)
        state.dispatchConversation({
          projectId: event.projectId,
          conversationId: event.conversationId,
          patch: { notice: message },
        });
      else
        state.dispatchUi({
          type: "project",
          id: event.projectId,
          patch: { actionError: message },
        });
    }
  }
  const unsubscribe = service.subscribe(receive);
  async function retry() {
    if (!active) return;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    const options = { signal: request.signal };
    store.getState().dispatchData({ type: "loading" });
    try {
      const [catalog, projects, lobby, account] = await Promise.all([
        service.catalog(options),
        service.listProjects(options),
        service.getProject(EMPTY_WORKSPACE_ID, options),
        service.getAccount(options),
      ]);
      const snapshots = await Promise.all(
        projects.map((p) => service.getProject(p.id, options)),
      );
      if (!active || request.signal.aborted) return;
      const state = store.getState();
      [lobby, ...snapshots].forEach((snapshot) =>
        state.dispatchData({ type: "snapshot", snapshot }),
      );
      state.setAccount(account);
      state.dispatchData({ type: "ready", catalog });
    } catch (error) {
      if (active && !request.signal.aborted)
        store
          .getState()
          .dispatchData({ type: "error", message: errorMessage(error) });
    }
  }
  void retry();
  return {
    retry,
    dispose() {
      active = false;
      controller?.abort();
      unsubscribe();
      store.getState().dispose();
    },
  };
}
