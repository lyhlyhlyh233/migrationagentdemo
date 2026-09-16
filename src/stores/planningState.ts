import type { PlanningConditions } from "@/domain/planning";
export interface PlanningView {
  intakeConditionsOpen?: boolean;
  conditionsDraft?: PlanningConditions;
  draftRevision?: number;
}
export const initialPlanningView = (): PlanningView => ({});
