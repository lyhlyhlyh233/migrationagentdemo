import type { OperationContext, StageId } from "@/domain/models";
import { buildAssessmentRisks } from "./assessment-knowledge";
import { assessmentFiles } from "./assessment-files";
import { initializeExecution, projectExecution } from "./execution-state";
import { generatePlanningSnapshot } from "./planning";
import { seedMissingDemoValidation } from "./demo-execution";
import { validationReport } from "./validation";
import type { MockRuntime } from "./runtime";

/** Only the Mock adapter calls this; an absent demo capability keeps normal gates. */
export function prepareDemoHandoff(
  rt: MockRuntime,
  c: OperationContext,
  target: StageId,
) {
  const s = rt.context(c);
  if (!s.demoMode) return;
  const added: string[] = [];
  if (target === "planning" && s.assessmentStatus !== "completed") {
    s.files.rvtools ||= "RVTools-示例资产.xlsx";
    s.files.presales ||= "迁移调研表-示例.xlsx";
    if (!s.risks.some((r) => r.stage === "research"))
      s.risks.push(...buildAssessmentRisks(s));
    s.assessmentStatus = "completed";
    assessmentFiles(rt, s);
    added.push(c.language === "en" ? "assessment results" : "评估结果");
  }
  if (target === "migration" && !s.planning?.batches.length) {
    generatePlanningSnapshot(rt, s);
    added.push(c.language === "en" ? "batch plan" : "批次规划");
  }
  if (target === "migration" && s.planning?.batches.length)
    s.planningStatus = "completed";
  if (target === "validation") {
    const e = initializeExecution(s);
    if (e.connectionStatus !== "ready") {
      e.connection ??= {
        ip: "192.0.2.10",
        port: 443,
        username: "migration-demo",
        checkedAt: new Date().toISOString(),
      };
      e.connectionStatus = "ready";
      e.connectionError = undefined;
      e.revision++;
      added.push(c.language === "en" ? "simulated connection" : "模拟连接");
    }
    if (seedMissingDemoValidation(s))
      added.push(c.language === "en" ? "validation example" : "验证样例");
    projectExecution(s);
    validationReport(rt, s.id);
  }
  if (added.length)
    rt.message(
      c,
      "system",
      c.language === "en"
        ? `Demo continuation added ${added.join(", ")}. Saved choices and records are preserved.`
        : `已为演示补齐${added.join("、")}，保留已保存的选择与记录。`,
      { operation: true },
    );
}
