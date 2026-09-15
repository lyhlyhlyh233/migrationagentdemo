import type {
  BusinessAttributes,
  PlanningCapacity,
  PlanningConditions,
  PlanningDependency,
} from "@/domain/planning";
import type { PageState } from "@/shared/ui/pagination-state";
export interface PlanningView {
  intakeConditionsOpen?: boolean;
  tab: "inputs" | "batches" | "resources" | "timeline";
  section: "attributes" | "dependencies" | "conditions";
  batchQuery?: string;
  assetMode?: "vms" | "systems";
  systemFocus?: string;
  attributeSelected?: string[];
  query: string;
  grade: string;
  selected: string[];
  assetPage: PageState;
  batchPage: PageState;
  expandedBatch?: string;
  conditionsDraft?: PlanningConditions;
  capacityDraft?: PlanningCapacity;
  dependenciesDraft?: PlanningDependency[];
  attributesDraft?: Partial<BusinessAttributes>;
  draftRevision?: number;
}
export const initialPlanningView = (): PlanningView => ({
  tab: "inputs",
  section: "conditions",
  query: "",
  grade: "",
  selected: [],
  assetPage: { page: 1, size: 20 },
  batchPage: { page: 1, size: 20 },
});
