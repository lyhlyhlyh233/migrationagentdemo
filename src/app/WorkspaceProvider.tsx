import { createServices } from "@/services";
import type { MigrationService } from "@/services/contracts";
import {
  createWorkspaceStore,
  type WorkspaceStore,
} from "@/stores/workspaceStore";
import { EmptyState } from "@/shared/ui/Status";
import { useEffect, useState, type ReactNode } from "react";
import { WorkspaceContext } from "./context";
import { serviceConfig } from "./config";
import { connectWorkspace } from "./workspaceSession";

export function WorkspaceProvider({
  children,
  service,
}: {
  children: ReactNode;
  service: MigrationService;
}) {
  const [session, setSession] = useState<{
    store: WorkspaceStore;
    service: MigrationService;
    retry: () => Promise<void>;
  } | null>(null);
  useEffect(() => {
    // Each effect lifetime owns a fresh store, including development effect replay.
    const store = createWorkspaceStore();
    const connection = connectWorkspace(store, service);
    setSession({ store, service, retry: connection.retry });
    return () => connection.dispose();
  }, [service]);
  if (!session || session.service !== service)
    return <EmptyState title="正在载入工作空间…" />;
  return (
    <WorkspaceContext.Provider value={session}>
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useServiceSession() {
  const [version, setVersion] = useState(0);
  const [service, setService] = useState<MigrationService | null>(null);
  useEffect(() => {
    const next = createServices(serviceConfig);
    setService(next);
    return () => next.dispose();
  }, [version]);
  return {
    service,
    reset: () => {
      setService(null);
      setVersion((value) => value + 1);
    },
  };
}
