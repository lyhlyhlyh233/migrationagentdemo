import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExecutionState, ExecutionTask } from "@/domain/execution";
import { MockMigrationService } from "@/services/mock";
import { AssessmentForm } from "@/features/research/AssessmentForm";
import { ExecutionDashboard } from "@/features/migration/ExecutionDashboard";
import { Composer } from "../Composer";

let service: MockMigrationService;
beforeEach(() => {
  service = new MockMigrationService();
});
afterEach(() => service.dispose());
describe("service-provided UI capabilities", () => {
  it("does not show assessment samples or sample conversation shortcuts without explicit capability", async () => {
    const snapshot = await service.getProject("lobby");
    const form = (demoTools?: boolean) =>
      renderToStaticMarkup(
        <AssessmentForm
          snapshot={snapshot}
          demoTools={demoTools}
          onCommand={() => {}}
          onUpload={() => {}}
          onDownload={() => {}}
        />,
      );
    expect(form()).not.toContain("使用样例数据");
    expect(form(true)).toContain("使用样例数据");
    const catalog = await service.catalog();
    delete catalog.capabilities;
    const composer = (demoTools?: boolean) =>
      renderToStaticMarkup(
        <Composer
          catalog={{
            ...catalog,
            capabilities: demoTools === undefined ? undefined : { demoTools },
          }}
          draft=""
          agentId={catalog.defaultAgent}
          modelId={catalog.defaultModel}
          busy={false}
          stage="planning"
          planningGenerated
          onDraft={() => {}}
          onAgent={() => {}}
          onModel={() => {}}
          onSend={() => {}}
          onStop={() => {}}
          onWork={() => {}}
          onPanel={() => {}}
        />,
      );
    expect(composer()).not.toContain("使用样例数据调整规划");
    expect(composer(false)).not.toContain("使用样例数据调整规划");
    expect(composer(true)).toContain("使用样例数据调整规划");
  });

  it("uses the service batch recommendation while preserving a valid explicit selection", () => {
    const task = (id: string, batchId: string): ExecutionTask => ({
      id,
      assetId: id,
      name: id,
      system: "",
      batchId,
      phase: "pending",
      created: false,
      progress: 0,
      speed: 0,
      syncedGB: 0,
      totalGB: 1,
      window: "",
      computeResource: "",
      network: "",
      scenario: "normal",
      scenarioUsed: false,
    });
    const execution: ExecutionState = {
      recommendedBatchId: "backend-batch-Z",
      sampleProgress: true,
      revision: 1,
      connectionStatus: "ready",
      issues: [],
      validations: [],
      feedback: [],
      trend: [],
      finalized: false,
      tasks: [
        task("vm-first", "backend-batch-A"),
        task("vm-recommended", "backend-batch-Z"),
      ],
    };
    const render = (selectedBatchId?: string) =>
      renderToStaticMarkup(
        <ExecutionDashboard
          execution={execution}
          selectedBatchId={selectedBatchId}
          onBatch={() => {}}
          onPage={() => {}}
        />,
      );
    expect(render()).toContain("vm-recommended");
    expect(render()).not.toContain("vm-first");
    expect(render()).not.toContain("示例进度");
    expect(render("backend-batch-A")).toContain("vm-first");
    expect(render("backend-batch-A")).not.toContain("vm-recommended");
    expect(render("removed-batch")).toContain("vm-recommended");
  });
});
