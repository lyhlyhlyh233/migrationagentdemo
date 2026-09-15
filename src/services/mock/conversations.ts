import { riskOverview } from "@/domain/assessment";
import { executionDiscussion } from "./execution-discussion";
import type { BusinessResult, OperationContext } from "@/domain/models";
import { translateText } from "@/shared/i18n/text";
import type { MessageInput, RequestOptions } from "../contracts";
import { requireCondition } from "../errors";
import {
  assessmentReportReply,
  assessmentWelcome,
} from "./assessment-knowledge";
import { previewDiscussionReply, previewThoughtSummary } from "./replies";
import { messageAttachmentError } from "@/shared/attachments";
import { planningDiscussion, previewPlanning } from "./planning";
import type { MockRuntime } from "./runtime";
export async function reply(
  rt: MockRuntime,
  c: OperationContext,
  input: MessageInput,
  options: RequestOptions,
) {
  const s = rt.context(c);
  // Keep the requested management scope stable while a reply is pending.
  const executionContext = input.executionContext && {
    ...input.executionContext,
    taskIds: input.executionContext.taskIds
      ? [...input.executionContext.taskIds]
      : undefined,
  };
  const executionRequest =
    !!executionContext && s.enteredStages.includes("migration");
  requireCondition(input.text.trim() || input.attachment, "请输入消息");
  if (input.attachment) {
    const error = messageAttachmentError(input.attachment);
    requireCondition(!error, error ?? "附件无效");
  }
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
      ) {
        const file = input.attachment;
        const attachment = file
          ? {
              id: `chat-file:${crypto.randomUUID()}`,
              filename: file.name,
              mediaType: file.type || "application/octet-stream",
              size: file.size,
            }
          : undefined;
        if (file && attachment)
          rt.attachments.set(`${s.id}/${attachment.id}`, {
            ...attachment,
            blob: file,
          });
        rt.message(c, "user", input.text, {
          attachment,
          requestId: input.requestId,
          agentId: input.agentId,
          modelId: input.modelId,
        });
      }
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
        conversation.title = (
          input.text.trim() ||
          input.attachment?.name ||
          "新会话"
        ).slice(0, 22);
      rt.publish(s);
      if (!openingRisks) await rt.sleep(1400, runOptions);
      let text: string = previewDiscussionReply(input.text, input.agentId);
      const results: BusinessResult[] = [];
      if (s.info && (c.stageId || executionRequest)) {
        if (input.attachment) {
          if (
            c.stageId === "planning" &&
            s.planning &&
            s.batchConfirmation !== "confirmed" &&
            !s.planning.preview
          ) {
            const preview = previewPlanning(
              rt,
              c,
              { kind: "import", filename: input.attachment.name },
              s.planning.revision,
            );
            text =
              "附件已接收。以下为样例调整预览，尚未读取实际文件内容；确认后才应用。";
            results.push({ kind: "planning-preview", previewId: preview.id });
          } else
            text =
              c.stageId === "planning" && s.batchConfirmation === "confirmed"
                ? "附件已保留在当前会话。规划已交接，当前只读，未修改规划或解析附件内容。"
                : "附件已接收并保留在当前会话。尚未解析实际内容；请说明希望调整的对象和要求。";
        } else if (executionRequest) {
          const discussion = await executionDiscussion(
            rt,
            c,
            input.text,
            input.context,
            executionContext,
          );
          text = discussion.text;
          results.push(...discussion.results);
        } else if (c.stageId === "research") {
          if (openingRisks) {
            text =
              "已打开风险与策略。你可以按类别批量采用建议，也可以保留现状直接继续，受阻对象会自动排除。";
          } else if (
            s.assessmentStatus === "completed" &&
            /^(跳过所有高风险|接受所有中风险|Skip all high risks|Accept all medium risks)$/.test(
              input.text,
            )
          ) {
            const high = /高风险|high risks/.test(input.text);
            const riskIds = s.risks
              .filter(
                (r) =>
                  r.stage === "research" &&
                  r.level === (high ? "high" : "medium"),
              )
              .map((r) => r.id);
            text = high
              ? "将高风险对应对象设为本次不迁，已有策略默认保留。请确认下方范围。"
              : "可接受约束的中风险将接受约束；需整改或不支持的项按现有忽略规则设为本次不迁。请确认影响范围。";
            results.push({
              kind: "risk-preview",
              riskIds,
              action: high ? "exclude" : "ignore-or-exclude",
            });
          } else if (
            s.assessmentStatus === "completed" &&
            /^(解读剩余风险|Explain remaining risks)$/.test(input.text)
          ) {
            const overview = riskOverview(s);
            text = `当前还有 ${overview.undecided} 条风险未选策略，${overview.excluded} 台虚拟机暂时排除。优先核对需要整改和当前不支持的对象；接受约束不会解除其他阻塞项。可以暂不处理，继续规划当前可纳入范围。`;
          } else if (s.assessmentStatus === "completed") {
            const report = assessmentReportReply(s, input.text);
            text = report.text;
            results.push(...report.results);
          } else {
            text = assessmentWelcome;
            results.push({ kind: "assessment-input", files: { ...s.files } });
          }
        } else if (c.stageId === "migration" || c.stageId === "validation") {
          const discussion = await executionDiscussion(
            rt,
            c,
            input.text,
            input.context,
          );
          text = discussion.text;
          results.push(...discussion.results);
        } else if (
          c.stageId === "planning" &&
          !/风险|risk|报告|report|交付|deliverable/i.test(input.text)
        ) {
          const discussion = planningDiscussion(rt, c, input.text);
          text = discussion.text;
          results.push(...discussion.results);
        } else if (c.stageId && /风险|risk/i.test(input.text)) {
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
