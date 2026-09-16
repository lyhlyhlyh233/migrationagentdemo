import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { MigrationService } from "@/services/contracts";
import type { WorkspaceStore, WorkspaceState } from "@/stores/workspaceStore";
export const WorkspaceContext = createContext<{
  store: WorkspaceStore;
  service: MigrationService;
  retry: () => Promise<void> | undefined;
} | null>(null);
export function useWorkspaceSession() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("WorkspaceProvider required");
  return context;
}
export function useWorkspace<T>(selector: (state: WorkspaceState) => T): T {
  return useStore(useWorkspaceSession().store, selector);
}
