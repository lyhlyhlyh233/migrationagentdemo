export const planningConditionFields = [
  ["fullBandwidth", "全量同步带宽(Gbps)"],
  ["incrementalBandwidth", "增量同步带宽(Gbps)"],
  ["downtime", "单批次最大停机窗口(h)"],
  ["cutoverWindow", "允许割接时间段"],
  ["freeze", "封网期"],
  ["startDate", "项目开始日期"],
  ["validationHours", "业务验证时长(h)"],
  ["concurrency", "单批次最大并发迁移数"],
] as const;
export const businessGradeLabels = {
  "": "待补充",
  general: "一般",
  important: "重要",
  critical: "核心",
};
export const planningPhaseLabels = {
  pilot: "试点",
  core: "核心业务",
  scale: "规模迁移",
};
