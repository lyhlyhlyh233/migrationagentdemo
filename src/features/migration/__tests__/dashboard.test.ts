import { describe, it, expect } from "vitest";
import type { ExecutionState, ExecutionTask } from "@/domain/execution";
import { executionDashboard } from "../execution-dashboard";
const task = (
  id: string,
  phase: ExecutionTask["phase"],
  extra: Partial<ExecutionTask> = {},
): ExecutionTask => ({
  id,
  assetId: id,
  name: id,
  system: "",
  batchId: "B01",
  phase,
  created: phase !== "pending",
  progress: 0,
  speed: 0,
  syncedGB: 0,
  totalGB: 10,
  window: "",
  computeResource: "",
  network: "",
  scenario: "normal",
  scenarioUsed: false,
  ...extra,
});
const state = (tasks: ExecutionTask[]): ExecutionState => ({
  revision: 1,
  connectionStatus: "ready",
  tasks,
  issues: [],
  validations: [],
  feedback: [],
  trend: [],
  finalized: false,
});
describe("actual execution dashboard", () => {
  it("partitions task states without counting ready VMs as syncing", () => {
    const phases: ExecutionTask["phase"][] = [
      "pending",
      "creating",
      "full",
      "incremental",
      "ready",
      "cutover",
      "validation",
      "paused",
      "failed",
    ];
    const d = executionDashboard(
      state(phases.map((p, i) => task(String(i), p))),
    );
    expect(d.distribution.map((g) => g.count)).toEqual([1, 3, 1, 1, 1, 1, 1]);
    expect(d.distribution.reduce((s, g) => s + g.count, 0)).toBe(9);
  });
  it("uses recorded timestamps, keeps unstarted batches blank and marks paused/failed batches", () => {
    const s = state([
      task("a", "pending"),
      task("b", "paused", {
        batchId: "B02",
        startedAt: "2026-09-20T01:00:00Z",
      }),
      task("c", "failed", {
        batchId: "B03",
        startedAt: "2026-09-20T02:00:00Z",
      }),
      task("d", "validation", {
        batchId: "B04",
        startedAt: "2026-09-20T03:00:00Z",
        completedAt: "2026-09-20T04:00:00Z",
      }),
    ]);
    s.trend = [{ time: "2026-09-20T05:00:00Z", speed: 0 }];
    const d = executionDashboard(s);
    expect(d.batches[0].start).toBeUndefined();
    expect(d.batches[1]).toMatchObject({
      label: "暂停",
      end: Date.parse(s.trend[0].time),
    });
    expect(d.batches[2].tone).toBe("danger");
    expect(d.batches[3]).toMatchObject({
      label: "割接完成",
      end: Date.parse("2026-09-20T04:00:00Z"),
    });
  });
  it("empty data never invents an execution time", () => {
    expect(executionDashboard(state([]))).toMatchObject({
      start: undefined,
      latest: undefined,
      batches: [],
    });
  });
});
