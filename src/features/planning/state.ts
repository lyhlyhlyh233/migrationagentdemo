import type {
  BusinessAttributes,
  PlanningCapacity,
  PlanningConditions,
  PlanningDependency,
} from "@/domain/planning";
import type { PageState } from "@/shared/ui/pagination-state";
export interface PlanningView {
  compactAction?: "conditions" | "import";
  tab: "inputs" | "batches" | "resources" | "timeline";
  section: "attributes" | "dependencies" | "conditions";
  batchQuery?: string;
  assetMode?: "vms" | "systems";
  systemFocus?: string;
  attributeSelected?: string[];
  query: string;
  grade: string;
  selected: string[];
  batchSelected: string[];
  assetPage: PageState;
  batchPage: PageState;
  expandedBatch?: string;
  conditionsDraft?: PlanningConditions;
  capacityDraft?: PlanningCapacity;
  dependenciesDraft?: PlanningDependency[];
  attributesDraft?: Partial<BusinessAttributes>;
  draftRevision?: number;
  cutover?: string;
  bufferDays?: number;
  targetBatch?: string;
}
export const initialPlanningView = (): PlanningView => ({
  tab: "inputs",
  section: "conditions",
  query: "",
  grade: "",
  selected: [],
  batchSelected: [],
  assetPage: { page: 1, size: 20 },
  batchPage: { page: 1, size: 20 },
});
