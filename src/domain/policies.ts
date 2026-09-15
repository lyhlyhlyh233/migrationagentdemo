import type { ExecutionTaskKind, ProjectSnapshot, StageId } from "./models";
import { planningIsStale } from "./planning";
export function stageEligibility(s: ProjectSnapshot): Record<StageId, boolean> {
  return {
    research: !!s.info,
    planning:
      s.enteredStages.includes("research") &&
      s.assessmentStatus === "completed",
    migration:
      s.enteredStages.includes("planning") &&
      s.planningStatus === "completed" &&
      !planningIsStale(s) &&
      !s.planning?.preview,
    validation:
      s.enteredStages.includes("migration") && s.validationTasks.length > 0,
  };
}
export function completedBatches(s: ProjectSnapshot) {
  return s.batchTasks
    .filter((b) => {
      const tasks = s.validationTasks.filter((v) => v.batchId === b.id);
      return (
        tasks.length === b.vmNames.length &&
        tasks.length > 0 &&
        tasks.every((v) => v.confirmed)
      );
    })
    .map((b) => b.id);
}
export function canExecute(s: ProjectSnapshot, kind: ExecutionTaskKind) {
  return (
    s.enteredStages.includes("migration") &&
    s.mdStatus === "ready" &&
    !s.executionApprovals[kind] &&
    s.executionMetrics[kind].total > s.executionMetrics[kind].completed
  );
}
