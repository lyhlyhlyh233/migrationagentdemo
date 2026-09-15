import PptxGenJS from "pptxgenjs";
import type { ProjectSnapshot } from "@/domain/models";
import { riskImpactLabels } from "@/shared/i18n/risks";
import { assessmentExportData, assessmentPptType } from "./assessment-files";

/** Loaded only for PPT downloads. All numbers come from the same workbook snapshot. */
export async function assessmentPresentation(snapshot: ProjectSnapshot) {
  const d = assessmentExportData(snapshot);
  const deck = new PptxGenJS();
  deck.layout = "LAYOUT_WIDE";
  deck.author = "MigrationDirector Ultimate";
  deck.subject = "调研评估结论与迁移范围（Mock）";
  deck.title = `${d.project} · 调研评估报告`;
  deck.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
  };
  const ink = "232529",
    muted = "61666E",
    line = "E1E3E6",
    green = "27805A",
    amber = "A26819",
    red = "B63D4C";
  let number = 0;
  function page(title: string) {
    const slide = deck.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addText(title, {
      x: 0.6,
      y: 0.45,
      w: 12.1,
      h: 0.65,
      fontSize: 30,
      bold: true,
      color: ink,
      margin: 0,
    });
    slide.addText(d.project, {
      x: 0.6,
      y: 1.15,
      w: 12.1,
      h: 0.5,
      fontSize: 15,
      color: muted,
      margin: 0,
      fit: "shrink",
    });
    slide.addText(
      "MigrationDirector Ultimate · 前端 Mock 示例 · 下载时项目快照",
      {
        x: 0.6,
        y: 7.02,
        w: 11.4,
        h: 0.25,
        fontSize: 10,
        color: muted,
        margin: 0,
      },
    );
    slide.addText(String(++number), {
      x: 12,
      y: 7.02,
      w: 0.7,
      h: 0.25,
      fontSize: 10,
      color: muted,
      align: "right",
      margin: 0,
    });
    return slide;
  }
  const cells = (rows: (string | number)[][]) =>
    rows.map((row, i) =>
      row.map((value) => ({
        text: String(value),
        options: {
          bold: i === 0,
          fill: { color: i === 0 ? "F0F1F2" : "FFFFFF" },
        },
      })),
    );
  const overview = page("迁移评估总览");
  overview.addText(`覆盖 ${d.counts.total} 台虚拟机`, {
    x: 0.6,
    y: 1.92,
    w: 12,
    h: 0.55,
    fontSize: 26,
    bold: true,
    color: ink,
    margin: 0,
  });
  overview.addText(
    `${d.counts.total - d.affected} 台无风险；${d.affected} 台风险虚拟机涉及 ${d.risks.length} 条风险。`,
    { x: 0.6, y: 2.65, w: 12, h: 0.45, fontSize: 18, color: muted, margin: 0 },
  );
  const groups = [
    { value: d.counts.direct, label: "按现状可迁", color: green },
    { value: d.counts.changed, label: "需调整或验证", color: amber },
    { value: d.counts.blocked, label: "当前方案不支持", color: red },
  ];
  let offset = 0.6;
  for (const g of groups) {
    const width = (12.1 * g.value) / Math.max(1, d.counts.total);
    if (width > 0)
      overview.addShape(deck.ShapeType.rect, {
        x: offset,
        y: 3.45,
        w: width,
        h: 0.3,
        fill: { color: g.color },
        line: { color: g.color },
      });
    offset += width;
  }
  groups.forEach((g, i) => {
    overview.addText(String(g.value), {
      x: 0.6 + i * 4.1,
      y: 4.05,
      w: 3.8,
      h: 0.8,
      fontSize: 42,
      bold: true,
      color: g.color,
      margin: 0,
    });
    overview.addText(g.label, {
      x: 0.6 + i * 4.1,
      y: 4.97,
      w: 3.8,
      h: 0.5,
      fontSize: 18,
      color: ink,
      margin: 0,
    });
  });
  overview.addText(
    "以上为原始评估分类，按虚拟机去重。策略调整后的实际迁移范围见后页。",
    {
      x: 0.6,
      y: 6.05,
      w: 12.1,
      h: 0.45,
      fontSize: 15,
      color: muted,
      margin: 0,
    },
  );

  const categories = page("风险类别与影响范围");
  categories.addTable(
    cells([
      ["风险类别", "风险记录", "涉及虚拟机", "不支持项"],
      ...d.categories.map((r) => [r.name, r.records, r.vms, r.blocked]),
    ]),
    {
      x: 0.6,
      y: 1.95,
      w: 12.1,
      colW: [5.8, 2.1, 2.1, 2.1],
      rowH: 0.48,
      fontFace: "Microsoft YaHei",
      fontSize: 17,
      color: ink,
      border: { pt: 0.5, color: line },
      margin: 8,
      fill: { color: "FFFFFF" },
      bold: false,
      autoPage: false,
    },
  );
  categories.addText(
    "各类别涉及虚拟机可能重叠，不能相加作为总量；逐台记录与依据见 Excel。",
    { x: 0.6, y: 6.15, w: 12.1, h: 0.5, fontSize: 15, color: muted, margin: 0 },
  );

  const findings = page("重点发现与处置建议");
  (["constraint", "change", "blocked"] as const).forEach((impact, i) => {
    const sample = d.risks.find((r) => r.impact === impact);
    const y = 1.95 + i * 1.48;
    findings.addShape(deck.ShapeType.rect, {
      x: 0.6,
      y,
      w: 2.45,
      h: 0.52,
      fill: { color: ["E7F2EC", "F9F0E1", "FAECEE"][i] },
      line: { transparency: 100 },
    });
    findings.addText(riskImpactLabels[impact], {
      x: 0.73,
      y: y + 0.07,
      w: 2.19,
      h: 0.38,
      fontSize: 17,
      bold: true,
      color: [green, amber, red][i],
      margin: 0,
    });
    findings.addText(sample?.description ?? "当前无此类发现", {
      x: 3.35,
      y,
      w: 9.15,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: ink,
      margin: 0,
    });
    findings.addText(sample?.recommendation ?? "以当前评估结果为准。", {
      x: 3.35,
      y: y + 0.68,
      w: 9.15,
      h: 0.62,
      fontSize: 16,
      color: muted,
      margin: 0,
      fit: "shrink",
    });
  });

  const scope = page("当前策略与迁移范围");
  scope.addText(`${d.eligible.size} 台可纳入`, {
    x: 0.6,
    y: 2,
    w: 5.8,
    h: 0.9,
    fontSize: 36,
    bold: true,
    color: green,
    margin: 0,
  });
  scope.addText(`${d.counts.total - d.eligible.size} 台暂时排除`, {
    x: 6.9,
    y: 2,
    w: 5.8,
    h: 0.9,
    fontSize: 36,
    bold: true,
    color: amber,
    margin: 0,
  });
  scope.addTable(
    cells([
      ["策略状态", "风险记录数"],
      ["未选策略", d.counts.undecided],
      ...(["ignore", "remediate", "exclude", "custom"] as const).map(
        (id, i) => [
          ["接受约束（忽略）", "整改后迁移", "本次不迁", "自定义策略"][i],
          d.risks.filter((r) => r.decision?.strategy === id).length,
        ],
      ),
    ]),
    {
      x: 0.6,
      y: 3.3,
      w: 5.8,
      colW: [4, 1.8],
      rowH: 0.42,
      fontSize: 16,
      color: ink,
      margin: 7,
      border: { pt: 0.5, color: line },
      autoPage: false,
    },
  );
  scope.addText(
    "可以暂不处理风险，继续规划。\n\n受阻、未通过整改核验及本次不迁的对象\n自动排除。接受约束仍需在实施时遵守\n相应条件。\n\n选择整改策略不等于完成整改。",
    {
      x: 6.9,
      y: 3.3,
      w: 5.8,
      h: 2.9,
      fontSize: 19,
      color: ink,
      margin: 0,
      valign: "top",
    },
  );

  const handoff = page("交付与规划衔接");
  [
    {
      title: "PPT 评估报告",
      detail: "用于汇报评估结论、风险分布、重点发现与当前迁移范围。",
      x: 0.6,
    },
    {
      title: "Excel 评估结果",
      detail: "用于逐台核对虚拟机、风险证据与策略，\n补充业务属性后继续规划。",
      x: 6.9,
    },
  ].forEach((item) => {
    handoff.addShape(deck.ShapeType.rect, {
      x: item.x,
      y: 2.1,
      w: 5.8,
      h: 2.2,
      fill: { color: "F4F5F6" },
      line: { transparency: 100 },
    });
    handoff.addText(item.title, {
      x: item.x + 0.25,
      y: 2.37,
      w: 5.3,
      h: 0.5,
      fontSize: 23,
      bold: true,
      color: ink,
      margin: 0,
    });
    handoff.addText(item.detail, {
      x: item.x + 0.25,
      y: 3.03,
      w: 5.3,
      h: 0.95,
      fontSize: 18,
      color: ink,
      margin: 0,
    });
  });
  handoff.addText(
    "下一步：人工确认进入规划，补充业务属性、业务依赖与带宽等约束，再生成批次计划。",
    {
      x: 0.6,
      y: 4.85,
      w: 12.1,
      h: 0.8,
      fontSize: 22,
      bold: true,
      color: ink,
      margin: 0,
    },
  );
  handoff.addText(d.note, {
    x: 0.6,
    y: 6,
    w: 12.1,
    h: 0.7,
    fontSize: 14,
    color: muted,
    margin: 0,
  });
  const bytes = await deck.write({
    outputType: "arraybuffer",
    compression: true,
  });
  return new Blob([bytes as ArrayBuffer], { type: assessmentPptType });
}
