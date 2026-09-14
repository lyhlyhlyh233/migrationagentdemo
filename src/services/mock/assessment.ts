import type { OperationContext } from "@/domain/models";
import type { RequestOptions } from "../contracts";
import { requireCondition } from "../errors";
import { addArtifact } from "./files";
import { initialRisks } from "./fixtures";
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
      s.assessmentStatus = "running";
      s.pending[c.conversationId] = {
        startedAt: Date.now(),
        runId: "assessment",
      };
      rt.publish(s);
      await rt.sleep(1600, options);
      s.risks = structuredClone(initialRisks);
      s.assessmentStatus = "completed";
      addArtifact(
        rt,
        s,
        "assessment-report",
        "调研评估报告",
        `项目：${s.info!.siteName}\n资产范围：${s.vmCount}\n风险：4 项，高风险：2 项。\n结论：闭环高风险后，人工确认进入规划。`,
        "report",
        "research",
      );
      rt.result(c, "评估已完成。资产基线已整理，进入规划前需要先闭环高风险。", [
        {
          kind: "summary",
          title: "调研评估结果",
          stageId: "research",
          metrics: [
            { label: "迁移范围", value: s.vmCount },
            { label: "识别风险", value: 4, tone: "warning" },
            { label: "高风险", value: 2, tone: "danger" },
          ],
        },
        { kind: "artifacts", artifactIds: ["assessment-report"] },
      ]);
      delete s.pending[c.conversationId];
      rt.notice(c, "评估完成，已生成风险与评估报告");
    },
    options,
  );
}
