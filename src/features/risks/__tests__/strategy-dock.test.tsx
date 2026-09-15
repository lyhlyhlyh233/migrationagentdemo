import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MockMigrationService } from "@/services/mock";
import { RiskStrategyDock } from "../RiskStrategyDock";
import { RiskStrategyEditor } from "../RiskStrategyEditor";
import { RiskBulkConfirmation } from "../RiskBulkActions";
import { RiskWorkspace } from "../RiskWorkspace";
import { highestRiskLevel } from "../presentation";
import { largeRiskFixture } from "./risk-fixtures";

const actions = { onSubmit: () => {}, onCancel: () => {}, saving: false };

describe("risk strategy dock", () => {
  it("shows the highest severity in merged findings independent of their order", () => {
    const risk = largeRiskFixture()[0];
    expect(
      highestRiskLevel([
        { ...risk, level: "low" },
        { ...risk, level: "medium" },
      ]),
    ).toBe("medium");
    expect(
      highestRiskLevel([
        { ...risk, level: "medium" },
        { ...risk, level: "high" },
        { ...risk, level: "low" },
      ]),
    ).toBe("high");
  });

  it("keeps a single non-modal editor with error feedback, saved strategy fields and a reachable cancel action when locked", () => {
    const risk = {
      ...largeRiskFixture()[0],
      decision: {
        strategy: "custom" as const,
        method: "agent" as const,
        note: "保留这台虚拟机的单独整改说明",
        selectedAt: "today",
      },
    };
    const html = renderToStaticMarkup(
      <RiskStrategyDock title="虚拟机：TEST-VM-001">
        <RiskStrategyEditor
          risks={[risk]}
          locked
          feedback="保存失败，输入已保留。"
          {...actions}
        />
      </RiskStrategyDock>,
    );
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('role="alert"');
    expect(html).toContain(risk.decision.note);
    expect(html).toMatch(/<button[^>]*>取消<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>应用策略<\/button>/);
    expect(html.match(/<form/g)).toHaveLength(1);
  });

  it("previews ignored constraints separately from blocked exclusions and preserves existing decisions", async () => {
    const service = new MockMigrationService();
    try {
      const snapshot = await service.getProject("lobby");
      const risk = largeRiskFixture()[0];
      const risks = [
        risk,
        { ...risk, id: 999, impact: "blocked" as const },
        {
          ...risk,
          id: 1000,
          decision: {
            strategy: "exclude" as const,
            method: "manual" as const,
            note: "已有人工作出选择",
            selectedAt: "today",
          },
        },
      ];
      snapshot.risks = risks;
      const html = renderToStaticMarkup(
        <RiskBulkConfirmation
          snapshot={snapshot}
          risks={risks}
          action="ignore-or-exclude"
          {...actions}
        />,
      );
      expect(html).toContain("本次处理 2 条，保留 1 条，覆盖 0 条已有策略。");
      expect(html).toContain(
        "接受约束（忽略）1 条；需整改或不支持的 1 条设为本次不迁。",
      );
      expect(html).not.toContain('checked=""');
      expect(html).toContain("应用策略");
    } finally {
      service.dispose();
    }
  });

  it("keeps strategy tools before the risk list and reports VM filter scope", async () => {
    const service = new MockMigrationService();
    try {
      const snapshot = await service.getProject("lobby");
      snapshot.risks = largeRiskFixture();
      const html = renderToStaticMarkup(
        <RiskWorkspace
          snapshot={snapshot}
          location={{ mode: "vm" }}
          onLocationChange={() => {}}
          onCommand={async () => false}
        />,
      );
      expect(html.indexOf('aria-label="风险浏览区"')).toBeGreaterThan(
        html.indexOf('aria-label="策略操作区"'),
      );
      expect(html).toContain("风险数与处理进度按当前筛选结果统计");
      expect(html).toContain("处理进度");
      expect(html).not.toContain("如何处理所选风险");
    } finally {
      service.dispose();
    }
  });
});
