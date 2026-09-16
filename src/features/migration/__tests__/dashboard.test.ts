import { describe, it, expect } from "vitest";
import type { ExecutionState, ExecutionTask } from "@/domain/execution";
import {
  batchProgressGroups,
  executionDashboard,
  taskExecutionStage,
  taskExecutionStatus,
} from "../execution-dashboard";
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
  it("partitions each batch into exclusive progress segments without mixing batches", () => {
    const phases: ExecutionTask["phase"][] = [
      "pending",
      "creating",
      "created",
      "full",
      "full-complete",
      "incremental",
      "ready",
      "cutover",
      "validation",
      "paused",
      "failed",
    ];
    for (const phase of phases) {
      expect(
        batchProgressGroups.filter((group) => group.phases.includes(phase)),
      ).toHaveLength(1);
    }
    const { batches } = executionDashboard(
      state([
        ...phases.map((phase, i) => task(String(i), phase)),
        task("second-batch", "validation", { batchId: "B02" }),
      ]),
    );
    expect(
      Object.fromEntries(batches[0].segments.map((s) => [s.id, s.count])),
    ).toEqual({ waiting: 4, active: 4, complete: 1, paused: 1, failed: 1 });
    expect(
      Object.fromEntries(batches[1].segments.map((s) => [s.id, s.count])),
    ).toEqual({ waiting: 0, active: 0, complete: 1, paused: 0, failed: 0 });
    for (const batch of batches) {
      expect(
        batch.segments.reduce((sum, segment) => sum + segment.count, 0),
      ).toBe(batch.total);
    }
  });
  it("displays stage separately from confirmation and running state", () => {
    const expected: [ExecutionTask["phase"], string][] = [
      ["pending", "创建任务"],
      ["creating", "创建任务"],
      ["created", "创建任务"],
      ["full", "全量同步"],
      ["full-complete", "全量同步"],
      ["incremental", "增量同步"],
      ["ready", "增量同步"],
      ["cutover", "割接"],
      ["validation", "结果验证"],
    ];
    for (const [phase, label] of expected) {
      expect(taskExecutionStage(task(phase, phase))).toBe(label);
    }
  });
  it("shows the interrupted stage for paused and failed tasks, without guessing when missing", () => {
    for (const phase of ["paused", "failed"] as const) {
      expect(
        taskExecutionStage(task(phase, phase, { resumePhase: "creating" })),
      ).toBe("创建任务");
      expect(
        taskExecutionStage(task(phase, phase, { resumePhase: "full" })),
      ).toBe("全量同步");
      expect(
        taskExecutionStage(task(phase, phase, { resumePhase: "incremental" })),
      ).toBe("增量同步");
      expect(
        taskExecutionStage(task(phase, phase, { resumePhase: "cutover" })),
      ).toBe("割接");
      expect(taskExecutionStage(task(phase, phase))).toBe("阶段待确认");
      expect(
        taskExecutionStage(task(phase, phase, { resumePhase: "failed" })),
      ).toBe("阶段待确认");
    }
  });
  it("keeps stage completion distinct from migration completion", () => {
    expect(taskExecutionStatus(task("created", "created"))).toBe("已完成");
    expect(taskExecutionStage(task("created", "created"))).toBe("创建任务");
    expect(taskExecutionStatus(task("full-complete", "full-complete"))).toBe(
      "已完成",
    );
    expect(taskExecutionStage(task("full-complete", "full-complete"))).toBe(
      "全量同步",
    );
    expect(taskExecutionStatus(task("ready", "ready"))).toBe("已就绪");
    expect(taskExecutionStatus(task("validation", "validation"))).toBe(
      "待验证",
    );
    expect(
      taskExecutionStatus(task("paused", "paused", { resumePhase: "full" })),
    ).toBe("已暂停");
    expect(
      taskExecutionStatus(task("failed", "failed", { resumePhase: "cutover" })),
    ).toBe("异常");
  });
  it("separates creation and confirmation gates from active synchronization", () => {
    const phases: ExecutionTask["phase"][] = [
      "pending",
      "creating",
      "created",
      "full",
      "full-complete",
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
    expect(d.distribution.find((group) => group.id === "syncing")?.count).toBe(
      2,
    );
    expect(
      d.distribution
        .filter((group) => group.id !== "syncing")
        .every((group) => group.count === 1),
    ).toBe(true);
    expect(d.distribution.reduce((s, g) => s + g.count, 0)).toBe(11);
  });
  it("shows waiting batch labels and counts created tasks independently of starts", () => {
    const data = executionDashboard(
      state([
        task("a", "creating", {
          created: false,
          startedAt: "2026-09-20T01:00:00Z",
        }),
        task("b", "created", {
          batchId: "B02",
          startedAt: "2026-09-20T01:00:00Z",
        }),
        task("c", "full-complete", {
          batchId: "B03",
          startedAt: "2026-09-20T01:00:00Z",
        }),
      ]),
    );
    expect(data.batches[0]).toMatchObject({ started: 1, created: 0 });
    expect(data.batches[1]).toMatchObject({ label: "待全量", created: 1 });
    expect(data.batches[2]).toMatchObject({ label: "待增量", created: 1 });
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
