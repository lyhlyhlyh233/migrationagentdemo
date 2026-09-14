import type { OperationContext } from "@/domain/models";
import type { RequestOptions } from "../contracts";
import { requireCondition } from "../errors";
import { offerHandoff } from "./handoff";
import { addArtifact } from "./files";
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
    async () => {
      rt.message(c, "user", "开始评估已准备的 RVTools 采集表和迁移调研表。", {
        operation: true,
        activity: "assessment-preparation",
      });
      s.assessmentStatus = "running";
      s.pending[c.conversationId] = {
        startedAt: Date.now(),
        runId: "assessment",
      };
      rt.publish(s);
      await rt.sleep(1600, options);
      s.risks = buildAssessmentRisks(s);
      s.assessmentStatus = "completed";
      const report = assessmentReportReply(s);
      addArtifact(
        rt,
        s,
        "assessment-report",
        "调研评估报告",
        `# ${s.info!.siteName} · 调研评估

${report.text}

## 规则与发现

${s.risks
  .map(
    (r) => `### ${r.description}
${r.rule}
${r.evidence}
建议：${r.recommendation}`,
  )
  .join("\n\n")}

说明：本文件为前端 Mock 输出，未执行真实文件解析或兼容性匹配。`,
        "report",
        "research",
        "md",
      );
      rt.result(c, report.text, report.results);
      delete s.pending[c.conversationId];
      offerHandoff(rt, c);
      rt.notice(c, "评估完成，已生成风险与评估报告");
    },
    options,
  );
}
