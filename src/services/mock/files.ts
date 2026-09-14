import type { Artifact, ProjectSnapshot, StageId } from "@/domain/models";
import type { MockRuntime } from "./runtime";
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
  addArtifact(
    rt,
    s,
    "scope",
    "虚拟机范围清单",
    workbook([
      {
        name: "虚拟机清单",
        rows: [["虚拟机名称", "IP", "CPU", "内存", "资源池"], ...s.scopeRows],
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
          ...s.scopeRows.map((r) => [r[0], "", "", "", ""]),
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
