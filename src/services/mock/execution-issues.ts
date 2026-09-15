import { translateText } from "@/shared/i18n/text";
import type { ExecutionIssue, ExecutionTask } from "@/domain/execution";
import type { OperationContext } from "@/domain/models";
import type { ProjectCommand } from "../contracts";
import { requireCondition } from "../errors";
import type { MockRuntime } from "./runtime";
import { publishExecution } from "./execution-state";
const descriptions = {
  normal: ["任务异常", "未发现明确原因，请检查远端日志。"],
  network: [
    "同步网络异常",
    "示例日志显示同步通道超时。建议重新建立同步通道，保留已同步数据。",
  ],
  capacity: [
    "目标容量不足",
    "示例日志显示目标存储可用容量低于任务需求。需人工扩容或释放资源，再复查。",
  ],
  permission: [
    "Migration 权限不足",
    "示例日志显示控制接口拒绝访问。需人工调整账号权限并重新检测连接。",
  ],
  feedback: ["业务验证问题", "请根据业务反馈检查应用与目标配置。"],
};
export function raiseIssue(
  rt: MockRuntime,
  c: OperationContext,
  task: ExecutionTask,
) {
  const s = rt.state(c.projectId),
    e = s.execution!;
  if (
    e.issues.some((i) => i.taskIds.includes(task.id) && i.state !== "resolved")
  )
    return;
  const issue: ExecutionIssue = {
    id: crypto.randomUUID(),
    taskIds: [task.id],
    category: task.scenario,
    title: descriptions[task.scenario][0],
    state: "collecting",
    origin: { ...c },
    evidence: "",
    diagnosis: "",
    note: "",
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  e.issues.push(issue);
  e.revision++;
  if (task.scenario === "permission") e.connectionStatus = "failed";
  rt.result(
    c,
    `${task.name}：${translateText(issue.title, c.language)}。正在获取模拟日志并诊断，其他未受影响任务保持原状态。`,
    [{ kind: "execution-work", view: "issues", issueId: issue.id }],
  );
  void diagnose(rt, c, issue.id).catch((error) => {
    if (!rt.disposed) rt.notice(c, String(error));
  });
}
export async function diagnose(
  rt: MockRuntime,
  c: OperationContext,
  id: string,
  simulate?: "log-failed" | "inconclusive",
) {
  const s = rt.context(c),
    e = s.execution!,
    issue = e.issues.find((i) => i.id === id);
  requireCondition(issue && issue.state !== "resolved", "问题不存在或已经解决");
  const key = `diagnose:${id}`;
  requireCondition(s.operations[key] !== "running", "诊断正在进行");
  s.operations[key] = "running";
  issue.state = "collecting";
  publishExecution(rt, s);
  try {
    await rt.sleep(1000);
    if (simulate === "log-failed") {
      issue.state = "log-failed";
      issue.evidence = "模拟日志获取失败，请重试。";
      return;
    }
    issue.logId = `execution-log:${id}`;
    const names = e.tasks
      .filter((t) => issue.taskIds.includes(t.id))
      .map((t) => t.name)
      .join(", ");
    rt.files.set(`${s.id}/${issue.logId}`, {
      filename: `migration-${id.slice(0, 8)}.log`,
      mediaType: "text/plain;charset=utf-8",
      body: `MOCK LOG / 模拟日志\n${issue.createdAt}\nTasks: ${names}\n${issue.title}\n${descriptions[issue.category][1]}\nNo real connection or credentials are included.`,
    });
    issue.evidence = `模拟日志：${names}，${issue.title}。`;
    issue.state = "diagnosing";
    publishExecution(rt, s);
    await rt.sleep(1000);
    issue.state = simulate === "inconclusive" ? "inconclusive" : "ready";
    issue.diagnosis =
      simulate === "inconclusive"
        ? "现有日志不足以定位问题，请补充证据或重新诊断。"
        : descriptions[issue.category][1];
    rt.result(
      c,
      `${translateText(issue.title, c.language)}：${translateText(issue.diagnosis, c.language)}\n\n请核对诊断并选择方案。自动方案也需要你确认；人工处理后需复查。`,
      [{ kind: "execution-work", view: "issues", issueId: id }],
    );
  } finally {
    delete s.operations[key];
    issue.updatedAt = new Date().toISOString();
    publishExecution(rt, s);
  }
}
export async function issueCommand(
  rt: MockRuntime,
  c: OperationContext,
  cmd: Extract<
    ProjectCommand,
    { type: "execution.remedy" | "execution.recheck" }
  >,
) {
  const s = rt.context(c),
    e = s.execution!,
    i = e.issues.find((i) => i.id === cmd.issueId);
  requireCondition(
    i &&
      !["collecting", "diagnosing", "repairing", "resolved"].includes(i.state),
    "问题状态已更新，请刷新后重试",
  );
  if (cmd.type === "execution.remedy") {
    requireCondition(
      i.state !== "inconclusive" && i.state !== "log-failed",
      "请先完成诊断",
    );
    requireCondition(
      cmd.solution !== "automatic" || i.category === "network",
      "该问题需要人工处理",
    );
    i.solution = cmd.solution;
    if (cmd.solution === "manual") {
      i.state = "manual";
      i.note = cmd.note;
      e.revision++;
      rt.result(
        c,
        "已采用人工方案。处理完成后填写说明并复查，任务不会自动恢复。",
        [],
      );
      publishExecution(rt, s);
      return;
    }
  } else {
    requireCondition(
      i.solution && cmd.note.trim().length >= 4,
      "请先选择处理方案，并填写至少 4 字的处理说明",
    );
    if (i.category === "permission")
      requireCondition(
        e.connectionStatus === "ready",
        "请先重新检测 Migration 连接",
      );
  }
  i.state = "repairing";
  i.note = cmd.note;
  publishExecution(rt, s);
  try {
    await rt.sleep(1600);
    if (cmd.simulateFailure) {
      i.state = "repair-failed";
      throw new Error("模拟修复或复查失败，输入已保留，请重试");
    }
    i.state = "resolved";
    e.revision++;
    rt.result(
      c,
      "问题复查通过。任务仍保持原位置，请确认恢复或重试；业务验证不会自动通过。",
      [{ kind: "execution-work", view: "tasks", taskIds: i.taskIds }],
    );
  } finally {
    i.updatedAt = new Date().toISOString();
    publishExecution(rt, s);
  }
}
