import type { ReactNode } from "react";
import type { RiskItem } from "@/domain/models";
import type { ProjectCommand } from "@/services/contracts";

export interface RiskInteractions {
  editable: boolean;
  saving: boolean;
  editing: boolean;
  navigationLocked?: boolean;
  inlineEditor?: { key: string; content: ReactNode };
  onEdit: (key: string, risks: RiskItem[], onlyUndecided?: boolean) => void;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
}
