import { planningTime } from "@/domain/planning";
import { translateText } from "@/shared/i18n/text";
import { migrationScope } from "@/domain/assessment";
import type {
  BusinessResult,
  OperationContext,
  ProjectSnapshot,
} from "@/domain/models";
import {
  eligiblePlanningAssets,
  planningRiskSignature,
  planningSummary,
  planningWarnings,
  type PlanningAdjustment,
  type PlanningInputPatch,
  type PlanningState,
} from "@/domain/planning";
import type { ProjectCommand, RequestOptions } from "../contracts";
import { requireCondition, ServiceError } from "../errors";
import { buildBatchTasks, buildVmTasks } from "./fixtures";
import { initializePlanning, isoAfter, planningAssets } from "./planning-data";
import { planningFiles } from "./planning-files";
import type { MockRuntime } from "./runtime";

function editable(s: ProjectSnapshot) {
  requireCondition(
    s.enteredStages.includes("planning") && s.planningStatus !== "locked",
    "请先人工确认进入规划设计",
  );
  requireCondition(s.batchConfirmation !== "confirmed", "规划已交接，当前只读");
  requireCondition(
    s.planningStatus !== "generating",
    "规划正在生成，请稍后重试",
  );
  return initializePlanning(s);
}
function fresh(p: PlanningState, revision: number) {
  if (p.revision !== revision)
    throw new ServiceError(
      "CONFLICT",
      "规划已在其他会话更新。输入已保留，请核对最新数据后重试。",
    );
}
function validInputs(patch: PlanningInputPatch) {
  if (patch.conditions) {
    const v = patch.conditions;
    requireCondition(
      [
        v.fullBandwidth,
        v.incrementalBandwidth,
        v.downtime,
        v.validationHours,
        v.concurrency,
      ].every((n) => Number.isFinite(n) && n > 0),
      "带宽、时长和并发数必须大于 0",
    );
    requireCondition(
      Number.isInteger(v.concurrency) && v.concurrency <= 10000,
      "并发数应为 1–10000 的整数",
    );
    requireCondition(
      /^\d{4}-\d{2}-\d{2}$/.test(v.startDate) &&
        Number.isFinite(Date.parse(v.startDate)) &&
        v.cutoverWindow.trim(),
      "请填写开始日期和割接时间段",
    );
  }
  if (patch.capacity)
    requireCondition(
      [patch.capacity.cpu, patch.capacity.memory, patch.capacity.storage].every(
        (n) => Number.isFinite(n) && n > 0,
      ) &&
        Number.isFinite(patch.capacity.reserve) &&
        patch.capacity.reserve >= 0 &&
        patch.capacity.reserve < 100,
      "容量必须大于 0，预留比例为 0–99%",
    );
  if (patch.dependencies)
    requireCondition(
      patch.dependencies.every(
        (d) =>
          d.upstream.trim() &&
          d.downstream.trim() &&
          d.upstream !== d.downstream,
      ) &&
        new Set(patch.dependencies.map((d) => d.id)).size ===
          patch.dependencies.length,
      "依赖上下游不能为空、不能相同，记录标识不能重复",
    );
}
function applyInput(p: PlanningState, patch: PlanningInputPatch) {
  validInputs(patch);
  if (patch.attributes) {
    const ids = new Set(patch.attributes.assetIds);
    requireCondition(
      ids.size > 0 && p.assets.filter((a) => ids.has(a.id)).length === ids.size,
      "所选虚拟机已变化，请重新选择",
    );
    const values = patch.attributes.values;
    if (values.grade !== undefined)
      requireCondition(
        ["", "general", "important", "critical"].includes(values.grade),
        "请选择业务等级",
      );
    p.assets = p.assets.map((a) => (ids.has(a.id) ? { ...a, ...values } : a));
  }
  if (patch.conditions) {
    p.conditions = structuredClone(patch.conditions);
    p.conditionsSource = "user";
  }
  if (patch.capacity) p.capacity = structuredClone(patch.capacity);
  if (patch.dependencies) p.dependencies = structuredClone(patch.dependencies);
  p.stale = p.batches.length > 0;
  p.revision++;
}
export function previewPlanning(
  rt: MockRuntime,
  c: OperationContext,
  change: PlanningAdjustment,
  revision: number,
) {
  const p = editable(rt.context(c));
  fresh(p, revision);
  requireCondition(!p.preview, "已有待确认调整，请先应用或取消");
  const rows: { label: string; before: string; after: string }[] = [];
  if (change.kind === "window") {
    const ids = new Set(change.batchIds);
    const batches = p.batches.filter((b) => ids.has(b.id));
    requireCondition(
      batches.length > 0 && batches.length === ids.size,
      "请选择有效批次",
    );
    requireCondition(
      Number.isFinite(Date.parse(change.cutover)) &&
        change.bufferDays >= 0 &&
        change.bufferDays <= 365 &&
        Number.isInteger(change.bufferDays),
      "请填写有效割接时间和 0–365 天缓冲",
    );
    batches.forEach((b) =>
      rows.push({
        label: b.id,
        before: `${b.cutover.replace("T", " ")} · ${b.bufferDays}d`,
        after: `${change.cutover.replace("T", " ")} · ${change.bufferDays}d`,
      }),
    );
  } else if (change.kind === "move") {
    requireCondition(
      p.batches.some((b) => b.id === change.targetBatchId),
      "目标批次不存在",
    );
    const ids = new Set(change.assetIds);
    const assigned = new Map(
      p.batches.flatMap((b) => b.assetIds.map((id) => [id, b.id] as const)),
    );
    requireCondition(
      ids.size > 0 && [...ids].every((id) => assigned.has(id)),
      "请选择已纳入规划的虚拟机",
    );
    const names = new Map(p.assets.map((a) => [a.id, a.name]));
    ids.forEach((id) =>
      rows.push({
        label: names.get(id)!,
        before: assigned.get(id)!,
        after: change.targetBatchId,
      }),
    );
  } else if (change.kind === "conditions") {
    validInputs({ conditions: { ...p.conditions, ...change.values } });
    Object.entries(change.values).forEach(([key, value]) =>
      rows.push({
        label: key,
        before: String(p.conditions[key as keyof typeof p.conditions]),
        after: String(value),
      }),
    );
  } else {
    rows.push(
      { label: "业务属性", before: "保留已有填写", after: "补充示例业务分组" },
      {
        label: "业务依赖",
        before: `${p.dependencies.length}`,
        after: "增加示例依赖（已有记录保留）",
      },
    );
  }
  p.preview = {
    id: crypto.randomUUID(),
    conversationId: c.conversationId,
    baseRevision: p.revision,
    change: structuredClone(change),
    rows,
  };
  return p.preview;
}
export function synchronizePlanningTasks(s: ProjectSnapshot) {
  const p = s.planning!;
  const assets = new Map(p.assets.map((a) => [a.id, a]));
  const oldTypes = buildBatchTasks([]);
  s.batchTasks = p.batches
    .filter((b) => b.assetIds.length)
    .map((b, i) => ({
      id: b.id,
      batchPhase: b.phase,
      vmNames: b.assetIds.flatMap((id) => assets.get(id)?.name ?? []),
      stageType: oldTypes[i]?.stageType ?? "full-sync",
      startDate: b.start.slice(0, 10),
      endDate: b.end.slice(0, 10),
      durationDays: Math.max(
        1,
        Math.ceil((planningTime(b.end) - planningTime(b.start)) / 86400000),
      ),
    }));
  const byName = new Map(p.assets.map((a) => [a.name, a]));
  s.vmTasks = s.batchTasks.flatMap(buildVmTasks).map((task) => ({
    ...task,
    id: byName.get(task.name)!.id,
    migrationMethod: byName.get(task.name)!.method,
    riskIds: s.risks.filter((r) => r.vmName === task.name).map((r) => r.id),
  }));
}
export function planningCommand(
  rt: MockRuntime,
  c: OperationContext,
  cmd: Extract<
    ProjectCommand,
    {
      type:
        | "planning.save"
        | "planning.preview"
        | "planning.apply"
        | "planning.cancel";
    }
  >,
) {
  const s = rt.context(c);
  const p = editable(s);
  if (cmd.type === "planning.save") {
    fresh(p, cmd.expectedRevision);
    requireCondition(!p.preview, "请先应用或取消待确认调整");
    applyInput(p, cmd.patch);
    rt.message(c, "user", "保存规划资料。", { operation: true });
    rt.result(
      c,
      p.stale
        ? "规划资料已保存。现有计划标记为待更新，确认后可重新生成模拟初稿。"
        : "规划资料已保存。业务信息可稍后补充，生成后仍会提示未核对的依赖。",
      [],
    );
  } else if (cmd.type === "planning.preview") {
    const preview = previewPlanning(rt, c, cmd.change, cmd.expectedRevision);
    rt.message(c, "user", "预览规划调整。", { operation: true });
    rt.result(
      c,
      "调整尚未应用。请核对修改前后与受影响范围，日期和时长仍为模拟估算。",
      [{ kind: "planning-preview", previewId: preview.id }],
    );
  } else {
    const preview = p.preview;
    requireCondition(
      preview?.id === cmd.previewId,
      "此预览已失效，请重新发起调整",
    );
    requireCondition(
      preview.conversationId === c.conversationId,
      "请在发起调整的会话中应用或取消",
    );
    if (cmd.type === "planning.cancel") {
      delete p.preview;
      return;
    }
    fresh(p, preview.baseRevision);
    const change = preview.change;
    if (change.kind === "conditions")
      applyInput(p, { conditions: { ...p.conditions, ...change.values } });
    else if (change.kind === "import") {
      p.assets = p.assets.map((a, i) => ({
        ...a,
        system:
          a.system ||
          ["门户系统", "订单系统", "数据服务", "监控平台"][
            Math.floor(i / 10) % 4
          ],
        grade: a.grade || (i % 3 ? "general" : "important"),
      }));
      if (!p.dependencies.length)
        p.dependencies = [
          {
            id: crypto.randomUUID(),
            upstream: "数据服务",
            downstream: "订单系统",
            strength: "strong",
            note: "示例：数据库访问",
          },
          {
            id: crypto.randomUUID(),
            upstream: "订单系统",
            downstream: "门户系统",
            strength: "weak",
            note: "示例：接口调用",
          },
        ];
      s.planningWorkbook = change.filename;
      p.stale = p.batches.length > 0;
      p.revision++;
    } else {
      requireCondition(
        p.riskSignature === planningRiskSignature(s),
        "评估策略已变化，请取消预览并重新生成规划",
      );
      if (change.kind === "window")
        p.batches = p.batches.map((b) =>
          change.batchIds.includes(b.id)
            ? {
                ...b,
                cutover: change.cutover,
                start: isoAfter(change.cutover, -2),
                end: isoAfter(change.cutover, 1 + change.bufferDays),
                bufferDays: change.bufferDays,
              }
            : b,
        );
      else {
        const ids = new Set(change.assetIds);
        p.batches = p.batches.map((b) => ({
          ...b,
          assetIds: [
            ...b.assetIds.filter((id) => !ids.has(id)),
            ...(b.id === change.targetBatchId ? [...ids] : []),
          ],
        }));
      }
      p.revision++;
      synchronizePlanningTasks(s);
    }
    delete p.preview;
    rt.message(c, "user", "应用规划调整。", { operation: true });
    rt.result(
      c,
      "调整已应用，规划和交付文件已同步。请继续核对业务依赖及示例时间安排。",
      [],
    );
  }
  planningFiles(rt, s);
}
export function planningIntro(rt: MockRuntime, c: OperationContext) {
  const s = rt.context(c);
  const p = initializePlanning(s);
  rt.message(c, "user", "开始迁移项目的规划设计", { operation: true });
  rt.result(
    c,
    `已接续评估结果：${p.assets.length} 台虚拟机，当前可纳入 ${migrationScope(s).length} 台。\n\n**先明确范围，再补充业务信息。** 我已保留评估策略；受阻和未完成整改验证的对象继续排除。业务属性与依赖可以稍后填写，我会标出尚未核对的部分。\n\n右侧可以填写迁移约束或直接生成模拟初稿。业务属性与依赖等详细资料，请在迁移规划页面补充。`,
    [{ kind: "planning-input" }],
    {
      reply: {
        summary: translateText(
          "已关联当前项目的评估范围与风险策略，整理规划所需资料。",
          c.language,
        ),
        durationMs: 1000,
      },
    },
  );
  planningFiles(rt, s);
}
export async function plan(
  rt: MockRuntime,
  c: OperationContext,
  _filename: string,
  options: RequestOptions,
) {
  const s = rt.context(c);
  const p = editable(s);
  requireCondition(!p.preview, "请先应用或取消待确认调整");
  requireCondition(
    !p.batches.length ||
      p.stale ||
      p.riskSignature !== planningRiskSignature(s),
    "当前规划已生成，可先修改资料或调整批次",
  );
  validInputs({ conditions: p.conditions, capacity: p.capacity });
  // Re-generation is serialized by one operation key; completed runs may be replaced after input edits.
  if (s.operations.planning === "completed") delete s.operations.planning;
  await rt.run(
    c,
    "planning",
    async (_s, runOptions, runId) => {
      rt.message(c, "user", "根据当前资料生成规划初稿。", { operation: true });
      s.planningStatus = "generating";
      s.pending[c.conversationId] = { startedAt: Date.now(), runId };
      rt.publish(s);
      await rt.sleep(1600, runOptions);
      p.assets = planningAssets(s);
      const priority = { "": 0, general: 0, important: 1, critical: 2 };
      const eligible = eligiblePlanningAssets(s).sort(
        (a, b) =>
          priority[a.grade] - priority[b.grade] || a.riskScore - b.riskScore,
      );
      const idByName = new Map(eligible.map((a) => [a.name, a.id]));
      p.batches = buildBatchTasks(eligible.map((a) => a.name))
        .filter((b) => b.vmNames.length)
        .map((b, i) => ({
          id: b.id,
          phase: b.batchPhase,
          assetIds: b.vmNames.map((n) => idByName.get(n)!),
          start: isoAfter(`${p.conditions.startDate}T00:00:00Z`, i * 2),
          cutover: isoAfter(`${p.conditions.startDate}T00:00:00Z`, i * 2 + 2),
          end: isoAfter(`${p.conditions.startDate}T00:00:00Z`, i * 2 + 4),
          downtime: i === 0 ? 1 : 2,
          bufferDays: 1,
          window: p.conditions.cutoverWindow,
        }));
      p.stale = false;
      p.riskSignature = planningRiskSignature(s);
      p.revision++;
      s.planningStatus = "completed";
      synchronizePlanningTasks(s);
      planningFiles(rt, s);
      const summary = planningSummary(p);
      const warnings = planningWarnings(p);
      rt.result(
        c,
        `**规划初稿已生成：${p.batches.length} 个批次，纳入 ${summary.included} 台，排除 ${summary.excluded} 台。**\n\n示例按试点、核心业务、规模迁移呈现分批安排。预计周期 ${summary.days} 天，批次停机估算合计 ${summary.downtime} 小时。\n\n${warnings.map((w) => `- ${w}`).join("\n")}\n\n这些时间为模拟估算，尚未按实际带宽与依赖精确求解。你可以打开工作台调整批次，或继续告诉我需要修改哪些条件。`,
        [
          {
            kind: "summary",
            title: "规划初稿 · 模拟估算",
            stageId: "planning",
            metrics: [
              { label: "迁移批次", value: p.batches.length },
              { label: "可纳入", value: summary.included, tone: "success" },
              { label: "暂时排除", value: summary.excluded, tone: "warning" },
            ],
          },
          { kind: "artifacts", artifactIds: ["batch-plan"] },
        ],
      );
      delete s.pending[c.conversationId];
      rt.notice(c, "规划初稿已生成，可在规划面板查看和调整");
    },
    options,
  );
}
export function planningDiscussion(
  rt: MockRuntime,
  c: OperationContext,
  input: string,
): { text: string; results: BusinessResult[] } {
  const s = rt.context(c);
  const p = initializePlanning(s);
  const results: BusinessResult[] = [];
  if (
    s.batchConfirmation !== "confirmed" &&
    !p.preview &&
    /B0?2|B-002/i.test(input) &&
    /周六|Saturday/i.test(input) &&
    p.batches.length
  ) {
    const batch = p.batches.find((b) => b.id === "B-002")!;
    const day = new Date(`${batch.cutover}:00Z`).getUTCDay();
    const preview = previewPlanning(
      rt,
      c,
      {
        kind: "window",
        batchIds: [batch.id],
        cutover: isoAfter(batch.cutover, (6 - day + 7) % 7 || 7),
        bufferDays: batch.bufferDays,
      },
      p.revision,
    );
    results.push({ kind: "planning-preview", previewId: preview.id });
    return {
      text: "已准备 B02 割接移至周六的调整预览。只修改该批次，其他批次保持原值；依赖影响需人工核对，确认后才应用。",
      results,
    };
  }
  if (
    s.batchConfirmation !== "confirmed" &&
    !p.preview &&
    /降低.*并发|reduce.*concurr/i.test(input)
  ) {
    const preview = previewPlanning(
      rt,
      c,
      {
        kind: "conditions",
        values: {
          concurrency: Math.max(1, Math.floor(p.conditions.concurrency / 2)),
        },
      },
      p.revision,
    );
    results.push({ kind: "planning-preview", previewId: preview.id });
    return {
      text: "建议先将并发数降低一半。应用后现有计划会标记为待更新；本轮不会把示例时长冒充精确重算结果。",
      results,
    };
  }
  if (/依据|原因|why|reason/i.test(input))
    return {
      text: "示例先安排试点，再扩展到核心业务与规模批次。\n\n- 受阻对象优先排除。\n- 强依赖应核对共同割接，弱依赖核对先后关系。\n- 集群类型和角色只用于提醒，不能替代真实拓扑。\n\n当前仍是模拟分批，日期未经过真实排程求解。",
      results,
    };
  return {
    text: p.preview
      ? "已有一份待确认调整。请先在规划面板应用或取消，再继续修改。"
      : "可以继续细化这份规划。请明确要调整的批次、虚拟机或约束值；也可以使用右侧表单。\n\n本轮支持演示“将 B02 割接改到周六”“降低单批次并发”，其他复杂要求需要先澄清，不会自动执行。",
    results: [{ kind: "planning-input" }],
  };
}
