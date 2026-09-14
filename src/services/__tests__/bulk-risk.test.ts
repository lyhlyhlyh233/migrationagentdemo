import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockMigrationService } from "../mock";
import { stageEligibility } from "@/domain/policies";
import { migrationScope } from "@/domain/assessment";
import { previewRiskDecisions } from "@/domain/risk-decisions";
import type { OperationContext } from "@/domain/models";

let service: MockMigrationService;
let context: OperationContext;
beforeEach(async () => {
  vi.useFakeTimers();
  service = new MockMigrationService();
  const s = await service.createProject(
    {
      siteName: "批量风险检查",
      office: "上海",
      region: "中国地区部",
      industry: "金融",
      migrationType: "虚拟化",
    },
    "zh-CN",
  );
  context = {
    projectId: s.id,
    conversationId: s.conversations[0].id,
    stageId: "research",
    language: "zh-CN",
  };
  await vi.runAllTimersAsync();
  await service.execute(context, { type: "assessment.useSamples" });
  const pending = service.execute(context, { type: "assessment.start" });
  await vi.runAllTimersAsync();
  await pending;
});
afterEach(() => {
  service.dispose();
  vi.useRealTimers();
});

describe("bulk risk commands", () => {
  it("applies mixed ignore/exclude atomically and matches the shared preview", async () => {
    const before = await service.getProject(context.projectId);
    const preview = previewRiskDecisions(
      before,
      before.risks,
      "ignore-or-exclude",
      true,
    );
    const child = await service.createConversation(
      context.projectId,
      "research",
      "zh-CN",
    );
    await service.execute(
      { ...context, conversationId: child.id },
      {
        type: "risk.ignoreOrExclude",
        riskIds: [...before.risks.map((r) => r.id), before.risks[0].id],
        onlyUndecided: true,
      },
    );
    const after = await service.getProject(context.projectId);
    expect(
      after.risks.every(
        (r) =>
          r.decision?.strategy ===
          (r.impact === "constraint" ? "ignore" : "exclude"),
      ),
    ).toBe(true);
    expect(after.scopeRows.length - migrationScope(after).length).toBe(
      preview.excludedVms,
    );
    const newMessages = after.messages.filter(
      (m) => !before.messages.some((old) => old.id === m.id),
    );
    expect(newMessages.filter((m) => m.role === "agent")).toHaveLength(1);
    expect(newMessages.every((m) => m.conversationId === child.id)).toBe(true);
    expect(newMessages.at(-1)?.text).toContain("条设为本次不迁");
    expect(stageEligibility(after).planning).toBe(true);
  });

  it("preserves concurrent exceptions and verified records unless overwrite is explicit", async () => {
    const before = await service.getProject(context.projectId);
    const change = before.risks.find((r) => r.impact === "change")!;
    await service.execute(context, {
      type: "risk.recommend",
      riskIds: [change.id],
    });
    await service.execute(context, {
      type: "risk.close",
      riskId: change.id,
      description: "已完成整改并核验目标兼容性。",
    });
    const verified = (await service.getProject(context.projectId)).risks.find(
      (r) => r.id === change.id,
    )!;
    await service.execute(context, {
      type: "risk.ignoreOrExclude",
      riskIds: before.risks.map((r) => r.id),
      onlyUndecided: true,
    });
    let after = await service.getProject(context.projectId);
    expect(after.risks.find((r) => r.id === change.id)).toEqual(verified);
    expect(
      previewRiskDecisions(after, [verified], "ignore-or-exclude", false)
        .verified,
    ).toBe(1);
    await service.execute(context, {
      type: "risk.ignoreOrExclude",
      riskIds: [change.id],
      onlyUndecided: false,
    });
    after = await service.getProject(context.projectId);
    expect(after.risks.find((r) => r.id === change.id)).toMatchObject({
      closed: false,
      closureDescription: "",
      decision: { strategy: "exclude" },
    });
    expect(migrationScope(after).some((row) => row[0] === change.vmName)).toBe(
      false,
    );
  });

  it("rejects invalid selections without partial changes, permits retry and enforces stage lock", async () => {
    const before = await service.getProject(context.projectId);
    await expect(
      service.execute(context, {
        type: "risk.ignoreOrExclude",
        riskIds: [before.risks[0].id, -1],
        onlyUndecided: true,
      }),
    ).rejects.toThrow();
    expect((await service.getProject(context.projectId)).risks).toEqual(
      before.risks,
    );
    await service.execute(context, {
      type: "risk.ignoreOrExclude",
      riskIds: [before.risks[0].id],
      onlyUndecided: true,
    });
    service.runtime.state(context.projectId).mdStatus = "connected";
    await expect(
      service.execute(context, {
        type: "risk.ignoreOrExclude",
        riskIds: [before.risks[1].id],
        onlyUndecided: true,
      }),
    ).rejects.toThrow("锁定");
  });
});
