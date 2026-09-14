import { conversationReducer } from "@/features/conversations/state";
import { EMPTY_WORKSPACE_ID } from "@/domain/models";
import { createServices } from "@/services";
import type { MigrationService } from "@/services/contracts";
import { errorMessage } from "@/services/errors";
import { useEffect, useReducer, useState, type ReactNode } from "react";
import { WorkspaceContext } from "./context";
import { dataReducer, initialData, initialUi, uiReducer } from "./state";
import { serviceConfig } from "./config";
function useWorkspaceState(service: MigrationService) {
  const [conversationState, dispatchConversation] = useReducer(
    conversationReducer,
    {},
  );
  const [data, dispatchData] = useReducer(dataReducer, initialData);
  const [ui, dispatchUi] = useReducer(uiReducer, initialUi);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const unsub = service.subscribe((e) => {
      if (!active) return;
      if (e.type === "snapshot")
        dispatchData({ type: "snapshot", snapshot: e.snapshot });
      else
        dispatchUi({
          type: "project",
          id: e.projectId,
          patch: { notice: e.type === "notice" ? e.text : e.message },
        });
    });
    dispatchData({ type: "loading" });
    Promise.all([
      service.catalog(options),
      service.listProjects(options),
      service.getProject(EMPTY_WORKSPACE_ID, options),
    ])
      .then(async ([catalog, projects, lobby]) => {
        const snapshots = await Promise.all(
          projects.map((p) => service.getProject(p.id, options)),
        );
        if (!active) return;
        [lobby, ...snapshots].forEach((snapshot) =>
          dispatchData({ type: "snapshot", snapshot }),
        );
        dispatchData({ type: "ready", catalog });
      })
      .catch((error) => {
        if (active)
          dispatchData({ type: "error", message: errorMessage(error) });
      });
    return () => {
      active = false;
      controller.abort();
      unsub();
    };
  }, [service, reload]);
  return {
    service,
    data,
    ui,
    dispatchUi,
    conversationState,
    dispatchConversation,
    retry: () => setReload((n) => n + 1),
  };
}
export type WorkspaceContextValue = ReturnType<typeof useWorkspaceState>;
export function WorkspaceProvider({
  children,
  service,
}: {
  children: ReactNode;
  service: MigrationService;
}) {
  const state = useWorkspaceState(service);
  return (
    <WorkspaceContext.Provider value={state}>
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useServiceSession() {
  const [service, setService] = useState(() => createServices(serviceConfig));
  useEffect(() => () => service.dispose(), [service]);
  return { service, reset: () => setService(createServices(serviceConfig)) };
}
