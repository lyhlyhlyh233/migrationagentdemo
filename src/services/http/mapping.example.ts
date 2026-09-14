import type { ProjectInfo } from "@/domain/models";
import { ServiceError } from "../errors";
// Illustrative input only, NOT a backend API specification. Replace with your real DTO.
interface ExampleProjectDto {
  project_id: string;
  display_name: string;
  industry: string;
  region: string;
  office: string;
  migration_type: string;
}
export function mapExampleProject(value: unknown): {
  id: string;
  info: ProjectInfo;
} {
  const v = value as Partial<ExampleProjectDto> | null;
  if (
    !v ||
    typeof v !== "object" ||
    ![
      "project_id",
      "display_name",
      "industry",
      "region",
      "office",
      "migration_type",
    ].every((k) => typeof v[k as keyof ExampleProjectDto] === "string")
  )
    throw new ServiceError("HTTP", "项目数据格式不正确");
  return {
    id: v.project_id!,
    info: {
      siteName: v.display_name!,
      industry: v.industry!,
      region: v.region!,
      office: v.office!,
      migrationType: v.migration_type!,
    },
  };
}
