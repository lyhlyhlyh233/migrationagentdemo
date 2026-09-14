import { createContext, useContext } from "react";
import type { WorkspaceContextValue } from "./WorkspaceProvider";
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);
export function useWorkspace() {
  const c = useContext(WorkspaceContext);
  if (!c) throw new Error("WorkspaceProvider required");
  return c;
}
