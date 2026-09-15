import type { OperationContext, ExecutionTaskKind } from "@/domain/models";
import {
  actionLabels,
  executionBlock,
  hasActiveControl,
  type ExecutionPreview,
} from "@/domain/execution";
import { eligiblePlanningAssets } from "@/domain/planning";
import type { ProjectCommand, RequestOptions } from "../contracts";
import { requireCondition } from "../errors";
import type { MockRuntime } from "./runtime";
import { initializeExecution, publishExecution } from "./execution-state";
import { startExecutionLoop } from "./execution-engine";
import { diagnose, issueCommand } from "./execution-issues";
export async function executionCommand(
  rt: MockRuntime,
  c: OperationContext,
  cmd: ProjectCommand,
  options: RequestOptions = {},
) {
  const s = rt.context(c),
    e = initializeExecution(s);
  requireCondition(!e.finalized, "项目已确认最终交付");
  if (cmd.type === "execution.connection") {
    const { ip, port, username, password } = cmd.values;
    requireCondition(
      /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
        ip.split(".").every((v) => Number(v) <= 255),
      "请输入有效 IPv4 地址",
    );
    requireCondition(
      Number.isInteger(port) &&
        port > 0 &&
        port <= 65535 &&
        username.trim() &&
        password.length,
      "请填写有效端口、用户名和密码",
    );
    requireCondition(
      e.connectionStatus !== "checking" &&
        !(hasActiveControl(e) && e.connectionStatus === "ready"),
      "存在正在执行的远程操作，请暂停或等待后应用",
    );
    const previousStatus = e.connectionStatus;
    e.connectionStatus = "checking";
    e.connectionError = undefined;
    publishExecution(rt, s);
    try {
      await rt.sleep(1200, options);
    } catch (error) {
      if (!rt.disposed) {
        e.connectionStatus = previousStatus;
        publishExecution(rt, s);
      }
      throw error;
    }
    if (cmd.simulateFailure) {
      e.connectionStatus = previousStatus === "ready" ? "ready" : "failed";
      e.connectionError = "模拟连接失败，原有效配置未更改。";
      publishExecution(rt, s);
      if (previousStatus === "ready") startExecutionLoop(rt, c);
      throw new Error(e.connectionError);
    }
    // Credentials are used only by this request; snapshots retain no password.
    e.connection = {
      ip,
      port,
      username: username.trim(),
      checkedAt: new Date().toISOString(),
    };
    e.connectionStatus = "ready";
    e.revision++;
    rt.result(
      c,
      "Migration 模拟连接检测通过。请选择批次，核对目标资源和网络映射后启动。",
      [{ kind: "execution-work", view: "tasks" }],
    );
    publishExecution(rt, s);
    startExecutionLoop(rt, c);
    return;
  }
  if (cmd.type === "execution.diagnose")
    return diagnose(rt, c, cmd.issueId, cmd.simulate);
  if (cmd.type === "execution.remedy" || cmd.type === "execution.recheck")
    return issueCommand(rt, c, cmd);
  if (cmd.type === "execution.cancel") {
    requireCondition(
      e.preview?.id === cmd.previewId &&
        e.preview.origin.conversationId === c.conversationId,
      "当前预览已变更或属于其他会话",
    );
    delete e.preview;
    publishExecution(rt, s);
    return;
  }
  if (cmd.type === "execution.preview") {
    requireCondition(!e.preview, "请先应用或取消当前调整预览");
    const ids = [...new Set(cmd.taskIds)],
      tasks = e.tasks.filter((t) => ids.includes(t.id));
    requireCondition(
      ids.length && tasks.length === ids.length,
      "未找到所选任务",
    );
    for (const t of tasks)
      requireCondition(
        !executionBlock(s, t, cmd.action),
        executionBlock(s, t, cmd.action) ?? "条件未满足",
      );
    if (cmd.action === "move")
      requireCondition(
        s.planning?.batches.some((b) => b.id === cmd.targetBatchId),
        "请选择有效目标批次",
      );
    if (cmd.action === "window")
      requireCondition(cmd.window?.trim(), "请填写后续割接窗口");
    if (cmd.action === "start")
      requireCondition(
        cmd.computeResource?.trim() && cmd.network?.trim(),
        "请填写目标资源与网络映射",
      );
    const preview: ExecutionPreview = {
      id: crypto.randomUUID(),
      revision: e.revision,
      origin: { ...c },
      ...cmd,
      taskIds: ids,
      rows: [
        {
          label: "对象范围",
          before: [...new Set(tasks.map((t) => t.batchId))].join("、"),
          after: `${tasks.length} 台虚拟机`,
        },
        {
          label: actionLabels[cmd.action],
          before:
            cmd.action === "window"
              ? [...new Set(tasks.map((t) => t.window))].join("；")
              : cmd.action === "move"
                ? [...new Set(tasks.map((t) => t.batchId))].join("、")
                : "保留已完成工作",
          after:
            cmd.action === "move"
              ? cmd.targetBatchId!
              : cmd.action === "window"
                ? cmd.window!
                : actionLabels[cmd.action],
        },
      ],
    };
    if (cmd.action === "cutover")
      preview.rows.push(
        {
          label: "割接窗口",
          before: [...new Set(tasks.map((t) => t.window))].join("；"),
          after: "请确认实际窗口允许执行",
        },
        {
          label: "同步与阻塞检查",
          before: `${tasks.filter((t) => t.lastSync).length} 台同步就绪`,
          after: "无未解决阻塞，提交时再次检查",
        },
      );
    e.preview = preview;
    publishExecution(rt, s);
    return;
  }
  if (cmd.type !== "execution.apply") return;
  const p = e.preview;
  requireCondition(
    p && p.id === cmd.previewId && p.origin.conversationId === c.conversationId,
    "当前预览已变更或属于其他会话",
  );
  requireCondition(
    p.revision === e.revision,
    "状态已变化，请取消预览后重新选择",
  );
  const tasks = e.tasks.filter((t) => p.taskIds.includes(t.id));
  const eligible = new Set(eligiblePlanningAssets(s).map((a) => a.id));
  for (const t of tasks) {
    requireCondition(
      !executionBlock(s, t, p.action),
      executionBlock(s, t, p.action) ?? "条件未满足",
    );
    if (p.action === "start")
      requireCondition(eligible.has(t.assetId), "所选对象已不满足迁移条件");
  }
  tasks.forEach((t, index) => {
    if (p.action === "move") t.batchId = p.targetBatchId!;
    else if (p.action === "window") t.window = p.window!.trim();
    else if (p.action === "pause") {
      t.resumePhase = t.phase;
      t.phase = "paused";
      t.speed = 0;
    } else {
      if (p.action === "start") {
        t.phase = "creating";
        t.computeResource = p.computeResource!;
        t.network = p.network!;
        t.scenario = index === 0 ? (p.scenario ?? "normal") : "normal";
        t.startedAt = new Date().toISOString();
      } else if (p.action === "cutover") {
        t.phase = "cutover";
        t.progress = 0;
      } else if (p.action === "increment") {
        t.phase = "incremental";
        t.progress = 0;
      } else t.phase = t.resumePhase ?? (t.created ? "full" : "creating");
      t.sourceConversationId = c.conversationId;
      rt.executionOrigins.set(`${s.id}/${t.id}`, { ...c, operationId: p.id });
    }
  });
  delete e.preview;
  e.revision++;
  rt.message(
    c,
    "user",
    `${actionLabels[p.action]}：${tasks.length} 台虚拟机。`,
    { operation: true },
  );
  rt.result(
    c,
    p.action === "cutover"
      ? "已人工确认所选范围，正在模拟割接。完成后进入技术核对与业务验证。"
      : "所选操作已应用。已完成工作保持不变，后续状态将同步更新到任务列表。",
    [{ kind: "execution-work", view: "tasks", taskIds: p.taskIds }],
  );
  publishExecution(rt, s);
  startExecutionLoop(rt, c);
}
// Legacy commands may still exist in historical answers; they must not bypass the new confirmations.
export async function checkMd(
  _rt: MockRuntime,
  _c: OperationContext,
  _options: RequestOptions,
) {
  throw new Error("请在连接面板填写 Migration 配置并检测");
}
export async function executeTasks(
  _rt: MockRuntime,
  _c: OperationContext,
  _kind: ExecutionTaskKind,
  _options: RequestOptions,
) {
  throw new Error("请在实施面板选择批次并确认操作预览");
}
