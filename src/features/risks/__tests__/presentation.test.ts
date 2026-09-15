import { describe, expect, it } from "vitest";
import type { RiskItem } from "@/domain/models";
import {
  categoryGroups,
  locationForRisks,
  risksAtLocation,
  ruleGroups,
  undecidedRisks,
  vmCount,
  vmGroups,
} from "../presentation";
const risk: RiskItem = {
  id: 1,
  stage: "research",
  batchId: "",
  vmId: "vm-1",
  vmName: "db",
  level: "high",
  description: "CPU",
  category: "compatibility",
  impact: "blocked",
  rule: "cpu",
  closed: false,
  closedAt: "",
  closureDescription: "",
};
describe("risk presentation grouping", () => {
  it("merges matching rules and impacts while preserving missing rules, stages and differing impacts", () => {
    const rows = [
      risk,
      { ...risk, id: 2, vmId: "vm-2" },
      { ...risk, id: 3, impact: "change" as const },
      { ...risk, id: 4, rule: undefined },
      { ...risk, id: 5, rule: undefined },
      { ...risk, id: 6, stage: "planning" as const },
    ];
    const groups = ruleGroups(rows);
    expect(groups).toHaveLength(5);
    expect(groups[0].risks.map((r) => r.id)).toEqual([1, 2]);
    expect(vmCount(rows)).toBe(2);
  });
  it("keeps identical VM names with different IDs separate and retains every finding per VM", () => {
    const rows = [risk, { ...risk, id: 2 }, { ...risk, id: 3, vmId: "vm-2" }];
    expect(vmGroups(rows).map((g) => g.risks.length)).toEqual([2, 1]);
    expect(categoryGroups(rows)[0].risks).toHaveLength(3);
  });
  it("never includes existing choices, verified findings or planning risks in category targets", () => {
    expect(
      undecidedRisks([
        risk,
        { ...risk, id: 2, closed: true },
        { ...risk, id: 3, stage: "planning" },
        {
          ...risk,
          id: 4,
          decision: {
            strategy: "exclude",
            method: "manual",
            note: "excluded",
            selectedAt: "today",
          },
        },
      ]).map((r) => r.id),
    ).toEqual([1]);
  });
});

it("rule navigation scopes VMs but preserves their other blocking findings", () => {
  const constraint = {
    ...risk,
    id: 2,
    rule: "drs",
    impact: "constraint" as const,
  };
  const other = { ...risk, id: 3, vmId: "vm-2" };
  const location = locationForRisks([constraint]);
  expect(location).toEqual({
    mode: "vm",
    sourceRiskIds: [2],
    vmKey: "id:vm-1",
  });
  expect(risksAtLocation([risk, constraint, other], location)).toEqual([
    risk,
    constraint,
  ]);
  expect(locationForRisks([risk, other]).vmKey).toBeUndefined();
  expect(risksAtLocation([risk], { mode: "vm", sourceRiskIds: [99] })).toEqual(
    [],
  );
  expect(risksAtLocation([risk, other], { mode: "vm" })).toEqual([risk, other]);
});
