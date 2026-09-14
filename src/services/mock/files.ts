import type { Artifact, ProjectSnapshot, StageId } from "@/domain/models";
import { migrationScope, migrationMethod } from "@/domain/assessment";
import { migrationMethodLabels } from "@/shared/i18n/risks";
import type { MockRuntime } from "./runtime";
import researchTemplateUrl from "./templates/migration-survey-template.xlsx?url";
import { ServiceError } from "../errors";
export function addArtifact(
  rt: MockRuntime,
  s: ProjectSnapshot,
  id: string,
  label: string,
  body: string,
  kind: Artifact["kind"],
  stageId: StageId,
  extension = "txt",
) {
  const artifact = {
    id,
    label,
    filename: `${s.info?.siteName ?? "项目"}-${label}.${extension}`,
    mediaType:
      extension === "xls"
        ? "application/vnd.ms-excel"
        : "text/plain;charset=utf-8",
    stageId,
    kind,
  };
  s.artifacts = s.artifacts.filter((a) => a.id !== id).concat(artifact);
  rt.files.set(`${s.id}/${id}`, {
    filename: artifact.filename,
    mediaType: artifact.mediaType,
    body,
  });
  return artifact;
}
export function workbook(
  sheets: { name: string; rows: (string | number)[][] }[],
) {
  const escape = (v: string | number) =>
    String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets.map((s) => `<Worksheet ss:Name="${escape(s.name)}"><Table>${s.rows.map((r) => `<Row>${r.map((v) => `<Cell><Data ss:Type="${typeof v === "number" ? "Number" : "String"}">${escape(v)}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet>`).join("")}</Workbook>`;
}
export function scopeArtifacts(rt: MockRuntime, s: ProjectSnapshot) {
  const rows = migrationScope(s);
  addArtifact(
    rt,
    s,
    "scope",
    "虚拟机范围清单",
    workbook([
      {
        name: "虚拟机清单",
        rows: [
          ["虚拟机名称", "IP", "CPU", "内存", "资源池", "迁移方式"],
          ...rows.map((row) => [
            ...row,
            migrationMethodLabels[migrationMethod(s, String(row[0]))],
          ]),
        ],
      },
    ]),
    "template",
    "planning",
    "xls",
  );
  addArtifact(
    rt,
    s,
    "planning-template",
    "迁移规划信息模板",
    workbook([
      {
        name: "虚拟机清单",
        rows: [
          ["虚拟机名称", "业务系统", "业务等级", "集群类型", "集群角色"],
          ...rows.map((r) => [r[0], "", "", "", ""]),
        ],
      },
      { name: "业务依赖关系", rows: [["源业务", "目标业务", "依赖说明"]] },
      { name: "迁移约束条件", rows: [["业务", "窗口", "约束"]] },
    ]),
    "template",
    "planning",
    "xls",
  );
}
export async function researchTemplate(signal: AbortSignal) {
  const response = await fetch(researchTemplateUrl, { signal });
  if (!response.ok)
    throw new ServiceError("HTTP", "模板下载失败，请重试。", response.status);
  const bytes = await response.arrayBuffer();
  const signature = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 4));
  // A static server may return its HTML fallback for a missing asset.
  if (signature.join(",") !== "80,75,3,4")
    throw new ServiceError("VALIDATION", "模板文件不可用，请重试或联系管理员。");
  const mediaType =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return {
    filename: "迁移调研表模板.xlsx",
    mediaType,
    blob: new Blob([bytes], { type: mediaType }),
  };
}
