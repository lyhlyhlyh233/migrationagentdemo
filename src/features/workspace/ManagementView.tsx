import type { PanelId } from "@/app/state";
import type { ProjectSnapshot } from "@/domain/models";
import { Deliverables } from "@/features/deliverables/Deliverables";
import { OperationLog } from "@/features/logs/OperationLog";
import { RiskPanel } from "@/features/risks/RiskPanel";
import type { RiskLocation } from "@/features/risks/presentation";
import type { ProjectCommand } from "@/services/contracts";
import styles from "./ManagementView.module.css";
export function ManagementView({
  panel,
  snapshot: s,
  onCommand,
  onDownload,
  riskLocation,
  onRiskLocation,
}: {
  panel: PanelId;
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onClose: () => void;
  onNotify: (s: string) => void;
  onDownload: (id: string) => void;
  riskLocation: RiskLocation;
  onRiskLocation: (location: RiskLocation) => void;
}) {
  return (
    <section
      className={`${styles.root} management-surface`}
      data-risk-view={panel === "risk" || undefined}
    >
      {panel === "deliverables" ? (
        <Deliverables artifacts={s.artifacts} onDownload={onDownload} />
      ) : panel === "logs" ? (
        <OperationLog snapshot={s} />
      ) : panel === "risk" ? (
        <RiskPanel
          snapshot={s}
          onCommand={onCommand}
          location={riskLocation}
          onLocationChange={onRiskLocation}
        />
      ) : null}
    </section>
  );
}
