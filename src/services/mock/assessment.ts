import type { OperationContext } from "@/domain/models";
import type { RequestOptions } from "../contracts";
import { requireCondition } from "../errors";
import { offerHandoff } from "./handoff";
import { assessmentFiles } from "./assessment-files";
import {
  buildAssessmentRisks,
  assessmentReportReply,
} from "./assessment-knowledge";
import type { MockRuntime } from "./runtime";
export async function assess(
  rt: MockRuntime,
  c: OperationContext,
  options: RequestOptions,
) {
  const s = rt.context(c);
  requireCondition(
    c.stageId === "research" && s.info && s.files.rvtools && s.files.presales,
    "请先准备两份评估资料",
  );
  await rt.run(
    c,
    "assessment",
    async (_s, runOptions, runId) => {
      rt.message(c, "user", "开始评估已准备的 RVTools 采集表和迁移调研表。", {
        operation: true,
        activity: "assessment-preparation",
      });
      s.assessmentStatus = "running";
      s.pending[c.conversationId] = {
        startedAt: Date.now(),
        runId,
      };
      rt.publish(s);
      await rt.sleep(1600, runOptions);
      s.risks = buildAssessmentRisks(s);
      s.assessmentStatus = "completed";
      const report = assessmentReportReply(s);
      assessmentFiles(rt, s);
      rt.result(c, report.text, report.results);
      delete s.pending[c.conversationId];
      offerHandoff(rt, c);
      rt.notice(c, "评估完成，已生成 PPT 报告和 Excel 评估结果");
    },
    options,
  );
}
