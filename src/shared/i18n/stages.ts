import type { StageId } from "@/domain/models";
export const stageTitles: Record<StageId, string> = {
  research: "调研评估",
  planning: "规划设计",
  migration: "迁移实施",
  validation: "结果验证",
};
export const stageLabels: Record<StageId, string> = {
  research: "评估",
  planning: "规划",
  migration: "实施",
  validation: "验证",
};
export const stageName = stageTitles;
