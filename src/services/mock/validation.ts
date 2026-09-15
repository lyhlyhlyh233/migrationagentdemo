import type { OperationContext } from "@/domain/models";
import { canValidate } from "@/domain/execution";
import type { ProjectCommand, FilePurpose } from "../contracts";
import { requireCondition } from "../errors";
import type { MockRuntime } from "./runtime";
import { publishExecution } from "./execution-state";
export function validationIntro(rt: MockRuntime, c: OperationContext) {
  const e = rt.state(c.projectId).execution!;
  rt.message(c, "user", "开始本批迁移结果验证", { operation: true });
  void rt
    .run(c, "intro:" + c.stageId, async (s, options, runId) => {
      s.pending[c.conversationId] = { startedAt: Date.now(), runId };
      rt.publish(s);
      await rt.sleep(1200, options);
      rt.result(
        c,
        `已有 ${e.validations.length} 台虚拟机完成割接。请先核对技术结果，再按批次或业务系统确认业务验证。\n\n预期配置差异可以说明并接受，意外差异需要处理。你可以返回实施继续其他批次，已有验证记录会保留。`,
        [{ kind: "execution-work", view: "validation" }],
      );
      delete s.pending[c.conversationId];
    })
    .catch((error) => {
      if (!rt.disposed && error?.code !== "STOPPED")
        rt.notice(c, error instanceof Error ? error.message : String(error));
    });
}
export function validationCommand(
  rt: MockRuntime,
  c: OperationContext,
  cmd: ProjectCommand,
) {
  const s = rt.context(c),
    e = s.execution;
  requireCondition(
    e && s.enteredStages.includes("validation"),
    "请先人工确认进入结果验证",
  );
  requireCondition(!e.finalized, "项目已确认最终交付");
  if ("expectedRevision" in cmd && cmd.expectedRevision !== undefined)
    requireCondition(
      cmd.expectedRevision === e.revision,
      "验证状态已更新，请核对最新结果后重新提交",
    );
  if (cmd.type === "validation.finalize") {
    requireCondition(
      e.tasks.length > 0 &&
        e.validations.length === e.tasks.length &&
        e.validations.every(
          (v) => v.business === "passed" && canValidate(e, v),
        ),
      "仍有未完成、待验证或受阻对象",
    );
    e.finalized = true;
    rt.result(c, "全部纳入范围已完成业务验证，本次迁移已确认最终交付。", [
      { kind: "artifacts", artifactIds: ["validation-report"] },
    ]);
  } else if (
    cmd.type === "validation.record" ||
    cmd.type === "validation.acceptDifference"
  ) {
    const ids = [...new Set(cmd.taskIds)],
      rows = e.validations.filter((v) => ids.includes(v.taskId));
    requireCondition(
      ids.length && ids.length === rows.length,
      "所选对象尚未完成割接",
    );
    if (cmd.type === "validation.acceptDifference") {
      requireCondition(
        cmd.note.trim().length >= 4 &&
          rows.every((v) => v.technical === "different"),
        "请选择存在差异的对象，并说明接受原因",
      );
      rows.forEach((v) => {
        v.technical = "accepted";
        v.acceptanceNote = cmd.note.trim();
      });
      rt.result(
        c,
        `已记录 ${rows.length} 台虚拟机的预期差异说明，请继续确认业务验证。`,
        [],
      );
    } else {
      requireCondition(
        cmd.status !== "passed" || rows.every((v) => canValidate(e, v)),
        "所选对象存在技术差异或未闭环问题，不能批量通过",
      );
      requireCondition(
        cmd.status !== "failed" || cmd.note.trim().length >= 4,
        "请填写业务不通过的原因",
      );
      rows.forEach((v) => {
        v.business = cmd.status;
        v.note = cmd.note.trim();
        v.confirmedBy = "当前用户";
        v.confirmedAt = new Date().toISOString();
      });
      rt.result(
        c,
        `已更新 ${rows.length} 台虚拟机的业务验证记录。未选择的对象保持原状态。`,
        [{ kind: "execution-work", view: "validation" }],
      );
    }
  } else if (cmd.type === "validation.feedback") {
    requireCondition(
      cmd.description.trim().length >= 4,
      "请填写至少 4 字的问题描述",
    );
    const ids = [
      ...new Set(
        cmd.taskIds.length
          ? cmd.taskIds
          : e.tasks
              .filter((t) => !cmd.batchId || t.batchId === cmd.batchId)
              .map((t) => t.id),
      ),
    ];
    requireCondition(
      ids.length && ids.every((id) => e.tasks.some((t) => t.id === id)),
      "反馈范围不属于当前项目",
    );
    const feedback = {
      id: crypto.randomUUID(),
      taskIds: ids,
      batchId: cmd.batchId,
      description: cmd.description.trim(),
      blocking: cmd.blocking,
      status: "open" as const,
      resolution: "",
      attachments: [],
      origin: { ...c },
    };
    e.feedback.push(feedback);
    if (cmd.blocking)
      e.validations
        .filter((v) => ids.includes(v.taskId))
        .forEach((v) => {
          v.business = "failed";
          v.note = feedback.description;
        });
    rt.result(
      c,
      "反馈已记录，可以补充附件。影响业务的问题需要处理并复查，普通建议不阻塞验收。",
      [{ kind: "execution-work", view: "validation" }],
    );
  } else if (cmd.type === "validation.feedbackReview") {
    const f = e.feedback.find((f) => f.id === cmd.feedbackId);
    requireCondition(
      f && f.status !== "resolved" && cmd.resolution.trim().length >= 4,
      "请填写处理或复查说明",
    );
    requireCondition(
      !cmd.confirm || f.status === "review",
      "请先提交处理说明，再确认复查",
    );
    f.resolution = cmd.resolution.trim();
    f.status = cmd.confirm ? "resolved" : "review";
    if (cmd.confirm && f.blocking)
      e.validations
        .filter((v) => f.taskIds.includes(v.taskId))
        .forEach((v) => {
          v.technical = "matched";
          v.actualValue = v.expectedValue;
          v.difference = "";
          v.business = "pending";
        });
    rt.result(
      c,
      cmd.confirm
        ? "模拟复查已完成，受影响对象恢复待业务验证，请重新人工确认。"
        : "处理说明已保存，请确认复查结果。",
      [],
    );
  } else return;
  e.revision++;
  validationReport(rt, s.id);
  publishExecution(rt, s);
}
export async function uploadExecutionAttachment(
  rt: MockRuntime,
  c: OperationContext,
  purpose: FilePurpose,
  file: File,
) {
  const s = rt.context(c),
    e = s.execution;
  requireCondition(e && !e.finalized, "请先进入实施，已交付项目不可修改");
  const [kind, id] = purpose.split(":");
  const record =
    kind === "issue"
      ? e.issues.find((i) => i.id === id)
      : e.feedback.find((f) => f.id === id);
  requireCondition(record, "未找到附件关联的问题");
  requireCondition(
    file.size > 0 && file.size <= 20 * 1024 * 1024,
    "附件须大于 0 且不超过 20 MB",
  );
  requireCondition(
    /\.(txt|log|zip|png|jpe?g|pdf|xlsx?|csv|docx)$/i.test(file.name),
    "请选择日志、图片、文档或 ZIP 附件",
  );
  const aid = `attachment:${crypto.randomUUID()}`;
  rt.attachments.set(`${s.id}/${aid}`, {
    filename: file.name,
    mediaType: file.type || "application/octet-stream",
    blob: file,
  });
  record.attachments.push(aid);
  e.revision++;
  rt.result(
    c,
    `已接收附件：${file.name}。附件仅在本次页面会话保留，未执行真实内容诊断。`,
    [],
  );
  publishExecution(rt, s);
}
export function validationReport(rt: MockRuntime, projectId: string) {
  const s = rt.state(projectId),
    e = s.execution;
  if (!e) return;
  const tasks = new Map(e.tasks.map((t) => [t.id, t]));
  const body = [
    "# 迁移验证报告",
    "",
    e.finalized ? "最终交付已确认" : "阶段性结果，仍需完成剩余迁移与验证",
    "本报告来自前端模拟，不代表真实远程校验。",
    "",
    `纳入 ${e.tasks.length} 台；割接 ${e.validations.length} 台；业务通过 ${e.validations.filter((v) => v.business === "passed").length} 台。`,
    "",
    ...e.validations.map((v) => {
      const t = tasks.get(v.taskId)!;
      return `${t.batchId} / ${t.name} / ${t.system || "未填写业务系统"}\n${v.configuration.map((c) => `${c.field}：源 ${c.source} / 规划 ${c.expected} / 目标 ${c.actual}`).join("\n")}\n技术：${v.technical}；源：${v.sourceValue}；规划：${v.expectedValue}；目标：${v.actualValue}\n差异说明：${v.acceptanceNote || v.difference || "无"}\n业务：${v.business}；${v.note}；${v.confirmedBy || ""} ${v.confirmedAt || ""}\n`;
    }),
    "## 问题与反馈",
    ...e.feedback.map(
      (f) => `${f.id} ${f.description} / ${f.status} / ${f.resolution}`,
    ),
    ...e.issues.map((i) => `${i.title} / ${i.state} / ${i.note}`),
  ].join("\n");
  rt.files.set(`${s.id}/validation-report`, {
    filename: `${s.info?.siteName}-迁移验证报告.md`,
    mediaType: "text/markdown;charset=utf-8",
    body,
  });
  if (!s.artifacts.some((a) => a.id === "validation-report"))
    s.artifacts.push({
      id: "validation-report",
      filename: `${s.info?.siteName}-迁移验证报告.md`,
      label: "迁移验证报告",
      stageId: "validation",
      kind: "report",
      mediaType: "text/markdown;charset=utf-8",
    });
}
