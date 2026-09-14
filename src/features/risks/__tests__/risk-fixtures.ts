import type { RiskItem } from "@/domain/models";

/** 60 VMs in one rule, 42 other rules, and a second category. */
export function largeRiskFixture(): RiskItem[] {
  return Array.from({ length: 105 }, (_, index) => ({
    id: index + 1,
    vmId: "fixture-vm-" + (index + 1),
    vmName: "TEST-VM-" + String(index + 1).padStart(3, "0"),
    stage: "research",
    batchId: "",
    category: index < 102 ? "disk" : "compatibility",
    rule: index < 60 ? "Shared disk rule" : "Rule " + (index + 1),
    description: index < 60 ? "Shared disk constraint" : "Risk " + (index + 1),
    impact: "constraint",
    level: "medium",
    closed: false,
    closedAt: "",
    closureDescription: "",
    recommendation: "Keep the disk constraint during migration.",
    recommendedStrategy: "ignore",
    recommendedMethod: "agentless",
  }));
}
