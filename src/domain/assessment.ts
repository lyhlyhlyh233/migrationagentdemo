import type { ProjectSnapshot, RiskItem } from "./models";

export const assessmentRisks = (s: ProjectSnapshot) =>
  s.risks.filter((r) => r.stage === "research");
export const hasRiskDecision = (r: RiskItem) => !!r.decision || r.closed;
export const excludedFromTool = (r: RiskItem) =>
  r.decision?.strategy === "exclude" || r.decision?.method === "manual";
export function riskReadyForExecution(r: RiskItem) {
  if (excludedFromTool(r)) return false;
  return (
    r.closed || r.impact === "constraint" || (!r.impact && r.level !== "high")
  );
}
export function migrationScope(s: ProjectSnapshot) {
  const excluded = new Set(
    s.risks.filter((r) => !riskReadyForExecution(r)).map((r) => r.vmName),
  );
  return s.scopeRows.filter((row) => !excluded.has(String(row[0])));
}
export const canChangeAssessmentDecision = (s: ProjectSnapshot) =>
  s.assessmentStatus === "completed" && s.mdStatus === "unconfigured";
export function assessmentCounts(s: ProjectSnapshot) {
  const risks = assessmentRisks(s);
  const blocked = new Set(
    risks.filter((r) => r.impact === "blocked").map((r) => r.vmName),
  );
  const changed = new Set(
    risks
      .filter((r) => r.impact === "change" && !blocked.has(r.vmName))
      .map((r) => r.vmName),
  );
  return {
    total: s.vmCount,
    blocked: blocked.size,
    changed: changed.size,
    direct: s.vmCount - blocked.size - changed.size,
    undecided: risks.filter((r) => !hasRiskDecision(r)).length,
    pendingRemediation: risks.filter(
      (r) => !r.closed && r.decision?.strategy === "remediate",
    ).length,
  };
}

export function migrationMethod(s: ProjectSnapshot, vmName: string) {
  return assessmentRisks(s).some(
    (r) =>
      r.vmName === vmName &&
      r.decision?.method === "agent" &&
      !excludedFromTool(r),
  )
    ? "agent"
    : "agentless";
}
