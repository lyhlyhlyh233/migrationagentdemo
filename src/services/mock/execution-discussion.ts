import { translateText } from "@/shared/i18n/text";
import type { BusinessResult, OperationContext } from "@/domain/models";
import {
  actionLabels,
  executionBlock,
  executionSummary,
  type ExecutionAction,
} from "@/domain/execution";
import type { MockRuntime } from "./runtime";
import { executionCommand } from "./execution";
export async function executionDiscussion(
  rt: MockRuntime,
  c: OperationContext,
  text: string,
  pageContext = "",
): Promise<{ text: string; results: BusinessResult[] }> {
  const s = rt.state(c.projectId),
    e = s.execution;
  if (!e)
    return { text: "请先确认规划交接，再配置 Migration 连接。", results: [] };
  const input = `${text} ${pageContext}`,
    summary = executionSummary(e);
  const match = input.match(/B[- ]?0*(\d+)/i);
  const batch = match
    ? s.planning?.batches.find(
        (b) => Number(b.id.replace(/\D/g, "")) === Number(match[1]),
      )
    : undefined;
  const task = e.tasks.find((t) => input.includes(t.name));
  const candidates = task
    ? [task]
    : batch
      ? e.tasks.filter((t) => t.batchId === batch.id)
      : [];
  const action: ExecutionAction | undefined = /暂停|pause/i.test(text)
    ? "pause"
    : /恢复|resume/i.test(text)
      ? "resume"
      : /重试任务|retry task/i.test(text)
        ? "retry"
        : /发起割接|执行割接|start cutover/i.test(text)
          ? "cutover"
          : /立即增量|触发增量|increment now/i.test(text)
            ? "increment"
            : /启动批次|启动 B|start batch/i.test(text)
              ? "start"
              : undefined;
  if (/报告|交付件|report|deliverable/i.test(text))
    return {
      text: "以下是当前项目已生成的交付文件。",
      results: [
        { kind: "artifacts", artifactIds: s.artifacts.map((a) => a.id) },
      ],
    };
  if (action && /为什么|如何|解释|说明|原因|why|how|explain/i.test(text))
    return {
      text: "暂停会保留已同步数据；恢复和重试从原位置继续。只有完成同步且没有阻塞的对象可割接，割接后仍须人工业务验证。",
      results: [{ kind: "execution-work", view: "tasks" }],
    };
  if (action) {
    if (!candidates.length)
      return {
        text: "请明确批次编号或虚拟机名称，例如“B001 发起割接”。我会先展示范围与检查结果，等待你确认。",
        results: [{ kind: "execution-work", view: "tasks" }],
      };
    if (e.preview)
      return {
        text: "已有待确认操作，请先应用或取消，避免覆盖当前选择。",
        results: [{ kind: "execution-work", view: "tasks" }],
      };
    const eligible = candidates.filter((t) => !executionBlock(s, t, action));
    if (!eligible.length)
      return {
        text: "当前对象不满足操作条件。请在任务列表查看同步状态、连接和未解决问题。",
        results: [{ kind: "execution-work", view: "tasks" }],
      };
    await executionCommand(rt, c, {
      type: "execution.preview",
      action,
      taskIds: eligible.map((t) => t.id),
      computeResource: "目标资源池",
      network: "目标业务网络",
    });
    return {
      text: `已准备${actionLabels[action]}预览：${eligible.length} 台满足条件，${candidates.length - eligible.length} 台暂不满足。请核对面板后确认，尚未执行任务操作。`,
      results: [{ kind: "execution-work", view: "tasks" }],
    };
  }
  if (
    /报错|异常|错误|诊断|日志|方案|error|issue|diagnos|log|remedy/i.test(text)
  ) {
    const issue = e.issues.find(
      (i) => i.state !== "resolved" && (!task || i.taskIds.includes(task.id)),
    );
    return {
      text: issue
        ? `${translateText(issue.title, c.language)}：${translateText(issue.diagnosis || "正在获取模拟日志。", c.language)}\n\n自动方案也需要人工确认；人工方案需补充处理说明并复查。`
        : "当前没有未解决的执行异常。任务失败后将自动获取模拟日志，并提供待人工确认的处理建议。",
      results: [{ kind: "execution-work", view: "issues", issueId: issue?.id }],
    };
  }
  if (/验证|验收|反馈|validation|verify|feedback/i.test(text))
    return {
      text: `当前割接完成 ${summary.cutover} 台，业务通过 ${summary.passed} 台。技术核对与业务确认分别进行；预期差异需说明，意外差异需整改。返回实施不会清除已验证结果。`,
      results: [{ kind: "execution-work", view: "validation" }],
    };
  if (
    /进度|情况|状态|概况|连接|下一步|progress|status|next|connection/i.test(
      text,
    )
  )
    return {
      text: `当前纳入 ${summary.total} 台，同步中 ${summary.syncing} 台，割接完成 ${summary.cutover} 台，异常 ${summary.failed} 台。\n\n${e.connectionStatus === "ready" ? "连接可用。请选择批次查看或操作，割接前需要人工确认。" : "请先填写并检测 Migration 连接。"}`,
      results: [
        {
          kind: "execution-work",
          view: e.connectionStatus === "ready" ? "tasks" : "connection",
        },
      ],
    };
  return {
    text: "我可以解释批次状态、分析已记录的问题，或为明确的任务操作生成预览。请说明批次、虚拟机及希望进行的操作；当前不会猜测并执行未识别的请求。",
    results: [{ kind: "execution-work", view: "tasks" }],
  };
}
