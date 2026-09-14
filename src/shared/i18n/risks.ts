import type {
  RiskCategory,
  RiskImpact,
  RiskStrategy,
  MigrationMethod,
} from "@/domain/models";
export const riskCategoryLabels: Record<RiskCategory, string> = {
  compatibility: "平台与系统兼容性",
  disk: "磁盘与快照",
  specification: "虚拟机规格",
  application: "应用适配",
  capacity: "目标资源容量",
  hardware: "目标硬件兼容性",
  feature: "平台功能与约束",
};
export const riskImpactLabels: Record<RiskImpact, string> = {
  constraint: "迁移有约束",
  change: "调整后可迁",
  blocked: "当前方案不支持",
};
export const riskStrategyLabels: Record<RiskStrategy, string> = {
  ignore: "接受约束（忽略）",
  remediate: "整改后迁移",
  exclude: "本次不迁",
  custom: "自定义策略",
};
export const migrationMethodLabels: Record<MigrationMethod, string> = {
  agentless: "免代理迁移",
  agent: "有代理迁移",
  manual: "另行迁移或重建",
};
