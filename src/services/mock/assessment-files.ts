import type { ProjectSnapshot } from "@/domain/models";
import {
  assessmentCounts,
  assessmentRisks,
  migrationScope,
} from "@/domain/assessment";
import { businessGradeLabels } from "@/shared/i18n/planning";
import {
  migrationMethodLabels,
  riskCategoryLabels,
  riskImpactLabels,
  riskStrategyLabels,
} from "@/shared/i18n/risks";
import { planningAssets } from "./planning-data";
import { addArtifact, workbook } from "./files";
import type { MockRuntime } from "./runtime";

export const assessmentPptType =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const assessmentFileIds = ["assessment-report", "assessment-results"];

export function assessmentExportData(s: ProjectSnapshot) {
  const risks = assessmentRisks(s);
  const counts = assessmentCounts(s);
  const eligible = new Set(migrationScope(s).map((row) => String(row[0])));
  const affected = new Set(risks.map((r) => r.vmName)).size;
  return {
    project: s.info?.siteName ?? "项目",
    counts,
    risks,
    eligible,
    affected,
    assets: planningAssets(s),
    categories: Object.entries(riskCategoryLabels)
      .map(([id, name]) => {
        const found = risks.filter((r) => r.category === id);
        return {
          name,
          records: found.length,
          vms: new Set(found.map((r) => r.vmName)).size,
          blocked: found.filter((r) => r.impact === "blocked").length,
        };
      })
      .filter((row) => row.records),
    note: "前端 Mock 示例输出，未解析实际上传资料，未执行真实兼容性匹配。评估分类按虚拟机去重；策略与迁移资格为下载时的当前项目快照。",
  };
}

export function assessmentFiles(rt: MockRuntime, s: ProjectSnapshot) {
  if (s.assessmentStatus !== "completed") return;
  const d = assessmentExportData(s);
  // PPTX is generated lazily on download; never store a renamed text placeholder.
  s.artifacts = s.artifacts
    .filter((a) => a.id !== "assessment-report")
    .concat({
      id: "assessment-report",
      label: "调研评估报告",
      filename: `${d.project}-调研评估报告.pptx`,
      mediaType: assessmentPptType,
      kind: "report",
      stageId: "research",
    });
  const grouped = new Map<string, typeof d.risks>();
  d.risks.forEach((r) =>
    grouped.set(r.vmName, [...(grouped.get(r.vmName) ?? []), r]),
  );
  addArtifact(
    rt,
    s,
    "assessment-results",
    "虚拟机评估结果",
    workbook([
      {
        name: "迁移整体评估总览",
        widths: [180, 640],
        rows: [
          ["指标", "评估结果"],
          ["项目", d.project],
          ["评估虚拟机", d.counts.total],
          ["无风险虚拟机", d.counts.total - d.affected],
          ["风险虚拟机（去重）", d.affected],
          ["风险记录", d.risks.length],
          ["按现状可迁", d.counts.direct],
          ["需调整或验证", d.counts.changed],
          ["当前方案不支持", d.counts.blocked],
          ["当前纳入范围", d.eligible.size],
          ["当前排除范围", d.counts.total - d.eligible.size],
          ["未选策略", d.counts.undecided],
          [
            "统计口径",
            `${d.counts.total - d.affected} 台无风险，${d.affected} 台风险虚拟机共涉及 ${d.risks.length} 条风险`,
          ],
          ["使用说明", d.note],
          [
            "规划衔接",
            "虚拟机评估总览可继续补充业务属性；规划模板同时提供业务依赖关系和迁移约束条件。",
          ],
        ],
      },
      {
        name: "虚拟机评估总览",
        widths: [
          130, 185, 140, 65, 80, 100, 90, 95, 80, 100, 125, 190, 130, 85, 100,
          100,
        ],
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
            "风险数",
            "当前迁移资格",
            "迁移方式",
            "迁移策略",
            "业务系统名称",
            "业务等级",
            "集群类型",
            "集群角色",
          ],
          ...d.assets.map((a) => [
            a.name,
            a.id,
            a.os,
            a.cpu,
            a.memory,
            a.storage,
            a.riskScore,
            { none: "无风险", low: "低", medium: "中", high: "高" }[
              a.riskLevel
            ],
            grouped.get(a.name)?.length ?? 0,
            d.eligible.has(a.name) ? "可纳入" : "暂时排除",
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
        name: "风险评估详情",
        widths: [
          75, 130, 120, 135, 220, 60, 115, 220, 310, 290, 125, 120, 230, 100,
        ],
        rows: [
          [
            "风险ID",
            "VM名称",
            "评估标识",
            "风险类别",
            "风险事项",
            "级别",
            "迁移影响",
            "规则依据",
            "证据",
            "评估建议",
            "当前策略",
            "迁移方式",
            "策略说明",
            "整改核验",
          ],
          ...d.risks.map((r) => [
            r.id,
            r.vmName,
            r.vmId,
            r.category ? riskCategoryLabels[r.category] : "其他",
            r.description,
            { low: "低", medium: "中", high: "高" }[r.level],
            r.impact ? riskImpactLabels[r.impact] : "待核对",
            r.rule ?? "",
            r.evidence ?? "",
            r.recommendation ?? "",
            r.decision ? riskStrategyLabels[r.decision.strategy] : "未选策略",
            r.decision ? migrationMethodLabels[r.decision.method] : "待确认",
            r.decision?.note ?? "",
            r.closed ? "已核验" : "未核验",
          ]),
        ],
      },
    ]),
    "report",
    "research",
    "xls",
  );
}
