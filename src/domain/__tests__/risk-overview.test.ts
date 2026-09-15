import { describe, expect, it } from "vitest";
import { riskOverview } from "../assessment";
import type { ProjectSnapshot, RiskItem } from "../models";

const risk = (
  id: number,
  vmName: string,
  changes: Partial<RiskItem> = {},
): RiskItem => ({
  id,
  vmName,
  vmId: vmName,
  stage: "research",
  batchId: "",
  description: "Sample risk",
  category: "disk",
  impact: "change",
  level: "high",
  closed: false,
  closedAt: "",
  closureDescription: "",
  ...changes,
});
const snapshot = (
  risks: RiskItem[],
  names = ["A", "B", "C"],
): Pick<ProjectSnapshot, "scopeRows" | "risks" | "assessmentStatus"> => ({
  assessmentStatus: "completed",
  scopeRows: names.map((name) => [name]),
  risks,
});
const decision = (strategy: "ignore" | "remediate" | "exclude") => ({
  strategy,
  method: "agentless" as const,
  note: "Reviewed",
  selectedAt: "today",
});

describe("project risk overview", () => {
  it("deduplicates risk IDs and VMs, counts multiple blocking findings separately and ignores out-of-scope records", () => {
    const a = risk(1, "A");
    const result = riskOverview(
      snapshot(
        [
          a,
          a,
          risk(2, "A"),
          risk(3, "B", { category: "capacity" }),
          risk(4, "A", { impact: "constraint", category: "feature" }),
          risk(5, "outside"),
        ],
        ["A", "A", "B", "C"],
      ),
    );
    expect(result).toMatchObject({
      total: 3,
      included: 1,
      excluded: 2,
      exclusionRisks: 3,
      undecided: 4,
    });
    expect(result.categories).toEqual([
      { category: "disk", count: 2, share: 2 / 3 },
      { category: "capacity", count: 1, share: 1 / 3 },
    ]);
  });

  it("accepts constraints but keeps remediation blocked until verified", () => {
    const s = snapshot([
      risk(1, "A", { impact: "constraint", decision: decision("ignore") }),
      risk(2, "B", { decision: decision("remediate") }),
      risk(3, "C", { decision: decision("remediate"), closed: true }),
    ]);
    expect(riskOverview(s)).toMatchObject({
      included: 2,
      excluded: 1,
      exclusionRisks: 1,
      undecided: 0,
    });
    const verified = {
      ...s,
      risks: s.risks.map((r) => ({ ...r, closed: true })),
    };
    expect(riskOverview(verified)).toMatchObject({
      included: 3,
      excluded: 0,
      categories: [],
    });
    expect(riskOverview(s).excluded).toBe(1); // No mutation of the earlier shared snapshot.
  });

  it("keeps explicitly excluded and manual migration objects outside the tool scope even when verified", () => {
    expect(
      riskOverview(
        snapshot([
          risk(1, "A", {
            impact: "constraint",
            closed: true,
            decision: decision("exclude"),
          }),
          risk(2, "B", {
            closed: true,
            decision: { ...decision("remediate"), method: "manual" },
          }),
        ]),
      ),
    ).toMatchObject({
      included: 1,
      excluded: 2,
      exclusionRisks: 2,
      undecided: 0,
    });
  });

  it("does not release a VM while another finding still blocks it", () => {
    const result = riskOverview(
      snapshot([
        risk(1, "A", { closed: true }),
        risk(2, "A", { category: "hardware" }),
      ]),
    );
    expect(result).toMatchObject({
      included: 2,
      excluded: 1,
      exclusionRisks: 1,
    });
    expect(result.categories).toEqual([
      { category: "hardware", count: 1, share: 1 },
    ]);
  });

  it("handles unknown categories and existing legacy qualification rules", () => {
    const result = riskOverview(
      snapshot([
        risk(1, "A", { category: undefined, impact: undefined, level: "high" }),
        risk(2, "B", { category: undefined, impact: undefined, level: "low" }),
      ]),
    );
    expect(result.categories).toEqual([
      { category: "other", count: 1, share: 1 },
    ]);
    expect(result.included).toBe(2);
  });

  it("returns safe empty figures and marks unfinished assessments as not ready", () => {
    expect(riskOverview(snapshot([], []))).toEqual({
      ready: true,
      total: 0,
      included: 0,
      excluded: 0,
      exclusionRisks: 0,
      undecided: 0,
      categories: [],
    });
    expect(riskOverview(snapshot([]))).toMatchObject({
      included: 3,
      excluded: 0,
      categories: [],
    });
    expect(
      riskOverview({ ...snapshot([]), assessmentStatus: "running" }).ready,
    ).toBe(false);
  });

  it("recomputes from each complete project snapshot without retaining another project's counts", () => {
    const first = snapshot([risk(1, "A")]);
    const second = snapshot([], ["A", "D"]);
    expect(riskOverview(first).excluded).toBe(1);
    expect(riskOverview(second)).toMatchObject({
      total: 2,
      included: 2,
      excluded: 0,
    });
    expect(riskOverview(first).excluded).toBe(1);
  });
});
