import type { RiskItem } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { stageName } from "@/shared/i18n/stages";
import { Icon } from "@/shared/ui/icons";
import { useState, type FormEvent } from "react";
export function RiskPanel({
  projectId,
  risks,
  projectExists,
  onCloseRisk,
}: {
  projectId: string;
  risks: RiskItem[];
  projectExists: boolean;
  onClose: () => void;
  onCloseRisk: (id: number, closureDescription: string) => Promise<boolean>;
}) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("全部");
  const [closingRiskId, setClosingRiskId] = useState<number | null>(null);
  const [closureDescription, setClosureDescription] = useState("");
  const visible = risks.filter(
    (risk) =>
      (level === "全部" || risk.level === level) &&
      `${risk.description}${t(risk.description)}${stageName[risk.stage]}${t(stageName[risk.stage])}${risk.batchId}${risk.vmName}${risk.vmId}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const highOpen = risks.filter(
    (risk) => risk.level === "high" && !risk.closed,
  ).length;
  const closedCount = risks.filter((risk) => risk.closed).length;
  async function confirmClosure(event: FormEvent) {
    event.preventDefault();
    if (closingRiskId === null || !closureDescription.trim()) return;
    if (!(await onCloseRisk(closingRiskId, closureDescription.trim()))) return;
    setClosingRiskId(null);
    setClosureDescription("");
  }
  return (
    <section
      className="archive-panel risk-panel"
      aria-label={t("交付风险清单")}
    >
      <header>
        <div>
          <h2>{t("交付风险")}</h2>
          <span>
            {t(
              highOpen
                ? `${highOpen} 项高风险需要处理，闭环后可推进到下一阶段。`
                : risks.length
                  ? "高风险已闭环，可以继续推进。"
                  : "完成评估后，在这里查看风险与处理建议。",
            )}
          </span>
        </div>
      </header>
      {risks.length > 0 && (
        <section className="risk-overview" aria-label={t("项目风险闭环概况")}>
          <header>
            <h3>{t("项目风险闭环")}</h3>
            <span>{t(`${closedCount} /${risks.length} 项已完成`)}</span>
          </header>
          <div className="risk-closure-track" aria-hidden="true">
            {closedCount > 0 && (
              <i className="closed-segment" style={{ flex: closedCount }} />
            )}
            {risks.length > closedCount && (
              <i
                className="open-segment"
                style={{ flex: risks.length - closedCount }}
              />
            )}
          </div>
          <div className="risk-chart-legend">
            <span>
              <i />
              {t(`已闭环${closedCount}`)}
            </span>
            <span>
              <i />
              {t(`待闭环${risks.length - closedCount}`)}
            </span>
            <span>{t(`高风险待处理${highOpen}`)}</span>
          </div>
        </section>
      )}
      <div className="risk-toolbar">
        <label>
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("搜索风险、批次或虚拟机")}
            aria-label={t("搜索交付风险")}
          />
        </label>
        <div>
          {["全部", "high", "medium", "low"].map((item) => (
            <button
              key={item}
              className={level === item ? "active" : ""}
              aria-pressed={level === item}
              onClick={() => setLevel(item)}
            >
              {t(item === "全部" ? "全部" : `${item}风险`)}
            </button>
          ))}
        </div>
      </div>
      <div className="risk-list">
        {visible.length ? (
          visible.map((risk) => (
            <article
              className={`risk-item ${risk.closed ? "is-closed" : ""}`}
              key={risk.id}
            >
              <div className="risk-item-heading">
                <span className={`risk-severity level-${risk.level}`}>
                  {t(risk.level)}
                </span>
                <h3>{t(risk.description)}</h3>
                <button
                  disabled={risk.closed}
                  onClick={() => {
                    setClosingRiskId(risk.id);
                    setClosureDescription("");
                  }}
                >
                  {t(risk.closed ? "已闭环" : "处理风险")}
                </button>
              </div>
              <div className="risk-item-meta">
                <span>R-{t(String(risk.id).padStart(3, "0"))}</span>
                <span>{t(stageName[risk.stage])}</span>
                <span>{t(risk.batchId)}</span>
                <span>
                  {risk.closed ? (
                    <>
                      <Icon name="check" size={12} /> {t(" 已闭环")}
                    </>
                  ) : (
                    "待闭环"
                  )}
                </span>
              </div>
              <details className="risk-item-details">
                <summary>
                  {t("查看影响范围与记录")}
                  <Icon name="chevron" size={12} />
                </summary>
                <dl>
                  <div>
                    <dt>{t("虚拟机")}</dt>
                    <dd>
                      {t(risk.vmName)} · {t(risk.vmId)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("闭环说明")}</dt>
                    <dd>
                      {t(risk.closed ? risk.closureDescription : "尚未填写")}
                    </dd>
                  </div>
                  {risk.closed && (
                    <div>
                      <dt>{t("闭环时间")}</dt>
                      <dd>{t(risk.closedAt)}</dd>
                    </div>
                  )}
                </dl>
              </details>
              {closingRiskId === risk.id && (
                <form className="inline-risk-form" onSubmit={confirmClosure}>
                  <label htmlFor={`closure-${projectId}-${risk.id}`}>
                    {t("处理措施与验证结果")}
                  </label>
                  <textarea
                    id={`closure-${projectId}-${risk.id}`}
                    value={closureDescription}
                    onChange={(event) =>
                      setClosureDescription(event.target.value)
                    }
                    placeholder={t("说明采取的措施、验证结果或闭环依据…")}
                    maxLength={300}
                    autoFocus
                    required
                  />
                  <div>
                    <span>{closureDescription.length} / 300</span>
                    <button
                      type="button"
                      onClick={() => setClosingRiskId(null)}
                    >
                      {t("取消")}
                    </button>
                    <button
                      type="submit"
                      className="primary"
                      disabled={!closureDescription.trim()}
                    >
                      {t("确认闭环")}
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))
        ) : (
          <p className="inline-empty">
            {t(
              projectExists ? "没有符合条件的风险。" : "先创建项目并完成评估。",
            )}
          </p>
        )}
      </div>
    </section>
  );
}
