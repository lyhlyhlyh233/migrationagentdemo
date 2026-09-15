import {
  businessGradeLabels,
  planningConditionFields,
  planningPhaseLabels,
} from "@/shared/i18n/planning";
import type { ProjectSnapshot } from "@/domain/models";
import {
  planningIsStale,
  planningSummary,
  planningWarnings,
  resourceTotals,
} from "@/domain/planning";
import { migrationMethodLabels } from "@/shared/i18n/risks";
import { addArtifact, workbook } from "./files";
import { isoAfter } from "./planning-data";
import type { MockRuntime } from "./runtime";

export function planningFiles(rt: MockRuntime, s: ProjectSnapshot) {
  const p = s.planning;
  if (!p) return;
  const assets = new Map(p.assets.map((a) => [a.id, a]));
  addArtifact(
    rt,
    s,
    "planning-template",
    "迁移规划信息模板",
    workbook([
      {
        name: "虚拟机评估总览",
        rows: [
          [
            "VM名称",
            "UUID",
            "GuestOS",
            "vCPU",
            "内存(GB)",
            "总磁盘容量(GB)",
            "风险总分",
            "风险等级",
            "迁移方式",
            "迁移策略",
            "业务系统名称",
            "业务等级",
            "集群类型",
            "集群角色",
          ],
          ...p.assets.map((a) => [
            a.name,
            a.id,
            a.os,
            a.cpu,
            a.memory,
            a.storage,
            a.riskScore,
            a.riskLevel,
            migrationMethodLabels[a.method],
            a.strategy,
            a.system,
            businessGradeLabels[a.grade],
            a.clusterType,
            a.clusterRole,
          ]),
        ],
      },
      {
        name: "业务依赖关系",
        rows: [
          ["上游系统(被依赖方)", "下游系统(依赖方)", "依赖强度", "依赖说明"],
          ...p.dependencies.map((d) => [
            d.upstream,
            d.downstream,
            d.strength === "strong" ? "强依赖" : "弱依赖",
            d.note,
          ]),
        ],
      },
      {
        name: "迁移约束条件",
        rows: [
          ["约束项", "值", "说明"],
          ...planningConditionFields.map(([key, label]) => [
            label,
            p.conditions[key],
            "可在表中或界面填写；上传内容本轮不解析，已有条件保留",
          ]),
        ],
      },
    ]),
    "template",
    "planning",
    "xls",
  );
  if (!p.batches.length) return;
  const summary = planningSummary(p);
  const warnings = planningWarnings(p);
  const cumulative = { cpu: 0, memory: 0, storage: 0 };
  const batchRows: (string | number)[][] = [];
  const resourceRows: (string | number)[][] = [];
  const vmRows: (string | number)[][] = [];
  p.batches.forEach((b) => {
    const members = b.assetIds.flatMap((id) => assets.get(id) ?? []);
    const total = resourceTotals(members);
    cumulative.cpu += total.cpu;
    cumulative.memory += total.memory;
    cumulative.storage += total.storage;
    batchRows.push([
      b.id,
      planningPhaseLabels[b.phase],
      members.length,
      total.cpu,
      total.memory,
      total.storage,
      ...["high", "medium", "low"].map(
        (level) => members.filter((a) => a.riskLevel === level).length,
      ),
      b.downtime,
      b.window,
      b.start,
      b.cutover,
      b.bufferDays,
      s.batchConfirmation === "confirmed" ? "已确认" : "待确认",
    ]);
    resourceRows.push([
      b.id,
      members.length,
      total.cpu,
      total.memory,
      total.storage,
      cumulative.cpu,
      cumulative.memory,
      cumulative.storage,
      ...(["cpu", "memory", "storage"] as const).map(
        (key) =>
          `${((cumulative[key] / (p.capacity[key] * (1 - p.capacity.reserve / 100))) * 100).toFixed(1)}%`,
      ),
    ]);
    members.forEach((a) =>
      vmRows.push([
        b.id,
        a.name,
        a.id,
        a.system || "待补充",
        businessGradeLabels[a.grade],
        a.clusterType,
        a.os,
        a.cpu,
        a.memory,
        a.disks,
        a.storage,
        a.riskScore,
        a.riskLevel,
        migrationMethodLabels[a.method],
        a.strategy,
      ]),
    );
  });
  const first = p.batches.map((b) => b.start).sort()[0];
  // Calendar columns are capped; long plans use a coarser day interval.
  const step = Math.max(1, Math.ceil(summary.days / 60));
  const dates = Array.from(
    { length: Math.min(61, Math.ceil(summary.days / step) + 1) },
    (_, i) => isoAfter(first, i * step).slice(0, 10),
  );
  const timeline = p.batches.map((b) => [
    b.id,
    b.start,
    b.end,
    ...dates.map((day) =>
      day >= b.start.slice(0, 10) && day <= b.end.slice(0, 10)
        ? day < b.cutover.slice(0, 10)
          ? "同步"
          : day === b.cutover.slice(0, 10)
            ? "割接"
            : "验证"
        : "",
    ),
  ]);
  const available = (key: "cpu" | "memory" | "storage") =>
    Math.round(p.capacity[key] * (1 - p.capacity.reserve / 100));
  addArtifact(
    rt,
    s,
    "batch-plan",
    "迁移批次与实施计划",
    workbook([
      {
        name: "批次规划",
        rows: [
          [
            "售后评估状态",
            "批次总数",
            "预计总迁移周期",
            "预计总停机时长",
            "售前可迁移VM数",
            "售后输入批次VM数",
            "排除VM数",
          ],
          [
            warnings.length ? "示例检查：存在待核对事项" : "示例检查完成",
            p.batches.length,
            `${summary.days} 天`,
            `${summary.downtime} h`,
            p.baselineEligibleIds.length,
            summary.included,
            summary.excluded,
          ],
          ["说明", "模拟估算，非真实排程。停机时长为各批次合计；资源单位 GB。"],
          ["规划资料状态", planningIsStale(s) ? "待更新" : "当前初稿"],
          ...warnings.map((w) => ["待核对", w]),
        ],
      },
      {
        name: "批次计划",
        rows: [
          [
            "批次编号",
            "批次阶段",
            "VM数量",
            "vCPU总计",
            "内存总计",
            "磁盘总计",
            "高风险数",
            "中风险数",
            "低风险数",
            "预计停机时长",
            "割接时间窗口",
            "全量同步开始",
            "割接切换时间",
            "批次缓冲天数",
            "状态",
          ],
          ...batchRows,
        ],
      },
      {
        name: "批次详情",
        rows: [
          [
            "批次编号",
            "VM名称",
            "UUID",
            "业务系统",
            "业务等级",
            "集群类型",
            "GuestOS",
            "vCPU",
            "内存",
            "磁盘数",
            "总磁盘容量",
            "风险总分",
            "风险等级",
            "迁移方式",
            "迁移策略",
          ],
          ...vmRows,
        ],
      },
      {
        name: "资源需求",
        rows: [
          ["资源总览", "值"],
          ["目标平台vCPU", p.capacity.cpu],
          ["目标平台内存", p.capacity.memory],
          ["目标平台存储", p.capacity.storage],
          ["预留比例", `${p.capacity.reserve}%`],
          ["可用vCPU", available("cpu")],
          ["可用内存", available("memory")],
          ["可用存储", available("storage")],
          ["迁移总需求vCPU", summary.resources.cpu],
          ["迁移总需求内存", summary.resources.memory],
          ["迁移总需求存储", summary.resources.storage],
          ["迁移后剩余vCPU", available("cpu") - summary.resources.cpu],
          ["迁移后剩余内存", available("memory") - summary.resources.memory],
          ["迁移后剩余存储", available("storage") - summary.resources.storage],
          [],
          [
            "批次编号",
            "VM数量",
            "新增vCPU",
            "新增内存",
            "新增存储",
            "累计vCPU",
            "累计内存",
            "累计存储",
            "vCPU占用率",
            "内存占用率",
            "存储占用率",
          ],
          ...resourceRows,
        ],
      },
      {
        name: "迁移时间线",
        rows: [
          ["批次编号", "开始", "结束", ...dates],
          ...timeline,
          [
            "说明",
            `模拟排程；日期列间隔 ${step} 天。蓝色同步、琥珀割接、绿色验证。`,
          ],
        ],
        timeline: true,
      },
    ]),
    "plan",
    "planning",
    "xls",
  );
  addArtifact(
    rt,
    s,
    "runbook",
    "RunBook",
    `规划为前端模拟，实施前需人工核对。\n\n${warnings.join("\n")}\n\n${p.batches.map((b) => `${b.id}：${b.assetIds.length} 台，割接 ${b.cutover}；验证后继续下一批次。`).join("\n")}\n\n受阻和未验证整改对象不创建工具任务。`,
    "plan",
    "planning",
  );
}
