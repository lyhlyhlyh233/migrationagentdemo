import type { BusinessResult, OperationContext } from "@/domain/models";
import { translateText } from "@/shared/i18n/text";
import type { RequestOptions } from "../contracts";
import { requireCondition } from "../errors";
import {
  assessmentReportReply,
  assessmentWelcome,
} from "./assessment-knowledge";
import { previewDiscussionReply, previewThoughtSummary } from "./replies";
import type { MockRuntime } from "./runtime";
export async function reply(
  rt: MockRuntime,
  c: OperationContext,
  input: { text: string; agentId: string; modelId: string; requestId: string },
  options: RequestOptions,
) {
  const s = rt.context(c);
  requireCondition(input.text.trim(), "请输入消息");
  requireCondition(!s.pending[c.conversationId], "当前会话正在回复");
  const openingRisks =
    /^(查看迁移风险与处置建议|Review migration risks and recommended strategies)$/.test(
      input.text,
    );
  await rt.run(
    c,
    `reply-${input.requestId}`,
    async (_s, runOptions, runId) => {
      const start = Date.now();
      s.pending[c.conversationId] = {
        startedAt: start,
        runId,
      };
      if (
        !s.messages.some(
          (m) => m.requestId === input.requestId && m.role === "user",
        )
      )
        rt.message(c, "user", input.text, {
          requestId: input.requestId,
          agentId: input.agentId,
          modelId: input.modelId,
        });
      const conversation = s.conversations.find(
        (v) => v.id === c.conversationId,
      )!;
      if (
        conversation.kind !== "main" &&
        !conversation.manuallyNamed &&
        s.messages.filter(
          (m) => m.role === "user" && m.conversationId === conversation.id,
        ).length === 1
      )
        conversation.title = input.text.trim().slice(0, 22);
      rt.publish(s);
      if (!openingRisks) await rt.sleep(1400, runOptions);
      let text: string = previewDiscussionReply(input.text, input.agentId);
      const results: BusinessResult[] = [];
      if (s.info && c.stageId) {
        if (c.stageId === "research") {
          if (openingRisks) {
            text =
              "已打开风险与策略。你可以按类别批量采用建议，也可以保留现状直接继续，受阻对象会自动排除。";
          } else if (s.assessmentStatus === "completed") {
            const report = assessmentReportReply(s, input.text);
            text = report.text;
            results.push(...report.results);
          } else {
            text = assessmentWelcome;
            results.push({ kind: "assessment-input", files: { ...s.files } });
          }
        } else if (/风险|risk/i.test(input.text)) {
          text =
            s.assessmentStatus === "completed"
              ? `当前有 ${s.risks.filter((r) => !r.closed).length} 项待处理风险。请优先核对高风险的处理措施与验证依据。`
              : "评估将重点核对平台兼容、资源容量与业务窗口。请先准备评估资料。";
          if (s.risks.length)
            results.push({
              kind: "summary",
              title: "项目风险概况",
              stageId: c.stageId,
              metrics: [
                {
                  label: "待处理风险",
                  value: s.risks.filter((r) => !r.closed).length,
                  tone: "warning",
                },
                {
                  label: "高风险",
                  value: s.risks.filter((r) => !r.closed && r.level === "high")
                    .length,
                  tone: "danger",
                },
              ],
            });
        } else if (/报告|产物|交付|report|deliverable/i.test(input.text)) {
          const files = s.artifacts.filter(
            (a) => a.kind === "report" || a.kind === "plan",
          );
          text = files.length
            ? "以下是当前项目已生成的交付文件。"
            : "完成评估后会生成报告，完成规划后会生成批次计划与 RunBook。";
          if (files.length)
            results.push({
              kind: "artifacts",
              artifactIds: files.map((a) => a.id),
            });
        } else if (/范围|概况|scope|overview/i.test(input.text))
          text = `当前项目「${s.info.siteName}」的迁移范围为 ${s.vmCount} 台虚拟机。可以在规划阶段核对并调整资产范围。`;
        else if (/下一步|进度|next|progress/i.test(input.text))
          text =
            c.stageId === "planning"
              ? "核对资产范围，补充业务依赖与迁移窗口。计划生成后可确认交接，受阻对象自动排除。"
              : c.stageId === "migration"
                ? "检查近端连接与配置，然后分别确认任务。已经启动的任务会继续在后台执行。"
                : "请对照源端与目标端配置，逐台或批量确认验收结果。";
      }
      rt.message(c, "agent", text, {
        requestId: input.requestId,
        agentId: input.agentId,
        modelId: input.modelId,
        operation: openingRisks,
        reply: openingRisks
          ? undefined
          : {
              summary: translateText(
                previewThoughtSummary(input.text, input.agentId),
                c.language,
              ),
              durationMs: Date.now() - start,
            },
        results,
      });
      delete s.pending[c.conversationId];
    },
    options,
  );
}
