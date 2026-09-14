import { Fragment, useId, useRef, useState } from "react";
import type { ProjectSnapshot, RiskItem } from "@/domain/models";
import {
  canChangeAssessmentDecision,
  excludedFromTool,
  hasRiskDecision,
  migrationScope,
  riskReadyForExecution,
} from "@/domain/assessment";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import {
  riskCategoryLabels,
  riskImpactLabels,
  riskStrategyLabels,
  migrationMethodLabels,
} from "@/shared/i18n/risks";
import { Icon } from "@/shared/ui/icons";
import { Button } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/Select";
import { RiskStrategyEditor } from "./RiskStrategyEditor";
import styles from "./RiskPanel.module.css";

export function RiskPanel({
  snapshot: s,
  onCommand,
}: {
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
}) {
  const t = useTranslation();
  const uid = useId();
  const editor = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState("category");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [details, setDetails] = useState<number[]>([]);
  const [verification, setVerification] = useState<number | null>(null);
  const [evidence, setEvidence] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const editable = canChangeAssessmentDecision(s);
  const included = migrationScope(s).length;
  const visible = s.risks.filter(
    (r) =>
      (level === "all" || r.level === level) &&
      (status === "all" ||
        (status === "undecided"
          ? !hasRiskDecision(r)
          : status === "excluded"
            ? !riskReadyForExecution(r)
            : hasRiskDecision(r))) &&
      `${r.description} ${t(r.description)} ${r.vmName} ${r.rule ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const groups = new Map<string, RiskItem[]>();
  visible.forEach((r) => {
    const key =
      groupBy === "vm"
        ? r.vmName
        : groupBy === "risk"
          ? "全部风险"
          : r.category
            ? riskCategoryLabels[r.category]
            : "规划与实施";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  });
  const selectedRisks = s.risks.filter((r) => selected.includes(r.id));
  const selectable = visible
    .filter((r) => r.stage === "research")
    .map((r) => r.id);
  const showEditor = editorOpen && selectedRisks.length > 0 && editable;
  function select(ids: number[], open = false) {
    setSelected(ids);
    setEditorOpen(open);
    setFeedback("");
    setVerification(null);
    if (open)
      requestAnimationFrame(() => {
        editor.current?.scrollIntoView({
          block: "nearest",
          behavior: "instant",
        });
        editor.current?.focus({ preventScroll: true });
      });
  }
  async function submit(cmd: ProjectCommand) {
    setSaving(true);
    setFeedback("");
    let ok = false;
    try {
      ok = await onCommand(cmd);
    } catch {
      ok = false;
    } finally {
      setSaving(false);
    }
    if (ok) {
      setSelected([]);
      setEditorOpen(false);
      setVerification(null);
      setEvidence("");
      setFeedback("已保存，处置说明已同步到发起会话。");
    } else setFeedback("保存失败，请检查策略或稍后重试。输入已保留。");
  }
  return (
    <section className={styles.root} aria-label={t("迁移风险与策略")}>
      <header className={styles.heading}>
        <h2>{t("迁移风险与策略")}</h2>
        <p>
          {t(
            "不必逐项确认。未满足迁移条件的对象自动排除，可迁对象的约束继续保留。",
          )}
        </p>
      </header>
      <div className={styles.overview}>
        <span>
          {t("可纳入")} <strong>{included}</strong>
        </span>
        <span>
          {t("暂时排除")}{" "}
          <strong data-tone="warning">{s.scopeRows.length - included}</strong>
        </span>
        <span>
          {t("未选策略")}{" "}
          <strong>{s.risks.filter((r) => !hasRiskDecision(r)).length}</strong>
        </span>
      </div>
      <div className={styles.filters}>
        <label className={styles.search}>
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("搜索风险、规则或虚拟机")}
            aria-label={t("搜索风险、规则或虚拟机")}
          />
        </label>
        <Select
          value={groupBy}
          onValueChange={setGroupBy}
          aria-label={t("风险分组")}
        >
          <option value="category">{t("按类别")}</option>
          <option value="vm">{t("按虚拟机")}</option>
          <option value="risk">{t("按风险")}</option>
        </Select>
        <Select
          value={level}
          onValueChange={setLevel}
          aria-label={t("风险级别")}
        >
          <option value="all">{t("全部级别")}</option>
          {(["high", "medium", "low"] as const).map((v) => (
            <option key={v} value={v}>
              {t(v)}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onValueChange={setStatus}
          aria-label={t("处置状态")}
        >
          <option value="all">{t("全部状态")}</option>
          <option value="undecided">{t("未选策略")}</option>
          <option value="excluded">{t("暂时排除")}</option>
          <option value="decided">{t("已选策略")}</option>
        </Select>
      </div>
      <div className={styles.batch}>
        <label>
          <input
            type="checkbox"
            disabled={!editable || saving || !selectable.length}
            checked={
              !!selectable.length &&
              selectable.every((id) => selected.includes(id))
            }
            onChange={(e) =>
              select(
                e.target.checked
                  ? [...new Set([...selected, ...selectable])]
                  : selected.filter((id) => !selectable.includes(id)),
              )
            }
          />
          {t("选择当前结果")}
        </label>
        <span>{t("已选 {0} 项", selected.length)}</span>
        {selected.length > 0 && (
          <>
            <Button onClick={() => select(selected, true)} disabled={saving}>
              {t("选择处置方案")}
            </Button>
            <button
              type="button"
              className={styles.textAction}
              onClick={() => select([])}
              disabled={saving}
            >
              {t("清空选择")}
            </button>
          </>
        )}
      </div>
      {!editable && s.risks.length > 0 && (
        <p className={styles.hint}>
          {t("实施准备已开始，策略已锁定；仍可补充验证记录。")}
        </p>
      )}
      {feedback && (
        <p role="status" className={styles.hint}>
          {t(feedback)}
        </p>
      )}
      <div className={styles.layout} data-editing={showEditor}>
        <div className={styles.tablePane}>
          <div
            className={styles.tableScroll}
            tabIndex={0}
            role="region"
            aria-label={t("风险表格，可横向滚动")}
          >
            <table className={styles.table} aria-label={t("分类风险列表")}>
              <colgroup>
                <col className={styles.selectColumn} />
                <col />
                <col className={styles.impactColumn} />
                <col className={styles.strategyColumn} />
                <col className={styles.actionColumn} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" aria-label={t("选择")} />
                  <th scope="col">{t("风险 / 虚拟机")}</th>
                  <th scope="col">{t("迁移影响")}</th>
                  <th scope="col">{t("处置策略")}</th>
                  <th scope="col">{t("操作")}</th>
                </tr>
              </thead>
              {[...groups].map(([name, risks]) => (
                <tbody key={name}>
                  <tr className={styles.groupRow}>
                    <th colSpan={5} scope="rowgroup">
                      <div>
                        <button
                          type="button"
                          aria-expanded={!collapsed.includes(name)}
                          onClick={() =>
                            setCollapsed(
                              collapsed.includes(name)
                                ? collapsed.filter((v) => v !== name)
                                : [...collapsed, name],
                            )
                          }
                        >
                          <Icon
                            name={
                              collapsed.includes(name) ? "right" : "chevron"
                            }
                            size={13}
                          />
                          {t(name)}
                          <span>{risks.length}</span>
                        </button>
                        {editable &&
                          risks.some((r) => r.stage === "research") && (
                            <button
                              type="button"
                              className={styles.textAction}
                              disabled={saving}
                              onClick={() =>
                                select(
                                  risks
                                    .filter((r) => r.stage === "research")
                                    .map((r) => r.id),
                                  true,
                                )
                              }
                            >
                              {t("为此组选择策略")}
                            </button>
                          )}
                      </div>
                    </th>
                  </tr>
                  {!collapsed.includes(name) &&
                    risks.map((r) => (
                      <Fragment key={r.id}>
                        <tr data-selected={selected.includes(r.id)}>
                          <td>
                            {r.stage === "research" && (
                              <input
                                type="checkbox"
                                aria-label={t("选择 {0}", t(r.description))}
                                disabled={!editable || saving}
                                checked={selected.includes(r.id)}
                                onChange={(e) =>
                                  select(
                                    e.target.checked
                                      ? [...selected, r.id]
                                      : selected.filter((id) => id !== r.id),
                                  )
                                }
                              />
                            )}
                          </td>
                          <th scope="row">
                            <div className={styles.riskTitle}>
                              <strong>{t(r.description)}</strong>
                              <span
                                className={styles.severity}
                                data-level={r.level}
                              >
                                {t(r.level)}
                              </span>
                            </div>
                            <small>
                              R-{r.id} · {r.vmName}
                            </small>
                          </th>
                          <td>
                            <span data-impact={r.impact}>
                              {r.impact
                                ? t(riskImpactLabels[r.impact])
                                : t("规划风险")}
                            </span>
                            <small>
                              {t(
                                riskReadyForExecution(r)
                                  ? "可纳入"
                                  : "暂时排除",
                              )}
                            </small>
                          </td>
                          <td>
                            <span>
                              {t(
                                r.closed
                                  ? "整改已验证"
                                  : r.decision
                                    ? riskStrategyLabels[r.decision.strategy]
                                    : "未选策略",
                              )}
                            </span>
                            <small>
                              {r.decision
                                ? t(migrationMethodLabels[r.decision.method])
                                : r.recommendedStrategy
                                  ? t(
                                      "建议：{0}",
                                      t(
                                        riskStrategyLabels[
                                          r.recommendedStrategy
                                        ],
                                      ),
                                    )
                                  : "—"}
                            </small>
                          </td>
                          <td>
                            <div className={styles.rowActions}>
                              {r.stage === "research" && editable && (
                                <button
                                  type="button"
                                  className={styles.textAction}
                                  disabled={saving}
                                  onClick={() => select([r.id], true)}
                                >
                                  {t(r.decision ? "调整策略" : "选择策略")}
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.textAction}
                                aria-expanded={details.includes(r.id)}
                                aria-controls={`${uid}-detail-${r.id}`}
                                onClick={() =>
                                  setDetails(
                                    details.includes(r.id)
                                      ? details.filter((id) => id !== r.id)
                                      : [...details, r.id],
                                  )
                                }
                              >
                                {t(
                                  details.includes(r.id)
                                    ? "收起详情"
                                    : "查看详情",
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {details.includes(r.id) && (
                          <tr
                            id={`${uid}-detail-${r.id}`}
                            className={styles.detailRow}
                          >
                            <td colSpan={5}>
                              <dl className={styles.evidence}>
                                <div>
                                  <dt>{t("评估建议")}</dt>
                                  <dd>
                                    {t(r.recommendation ?? r.description)}
                                  </dd>
                                </div>
                                <div>
                                  <dt>{t("规则依据与原始发现")}</dt>
                                  <dd>
                                    {t(r.rule ?? "规划风险")}
                                    <br />
                                    {t(r.evidence ?? r.description)}
                                  </dd>
                                </div>
                                {r.decision?.note && (
                                  <div>
                                    <dt>{t("策略说明")}</dt>
                                    <dd>{t(r.decision.note)}</dd>
                                  </div>
                                )}
                                {r.closed && (
                                  <div>
                                    <dt>{t("整改措施与验证依据")}</dt>
                                    <dd>{r.closureDescription}</dd>
                                  </div>
                                )}
                              </dl>
                              {!r.closed &&
                                !excludedFromTool(r) &&
                                (r.stage !== "research" ||
                                  (r.decision &&
                                    ["remediate", "custom"].includes(
                                      r.decision.strategy,
                                    ))) &&
                                verification !== r.id && (
                                  <Button
                                    disabled={saving}
                                    onClick={() => {
                                      setVerification(r.id);
                                      setEvidence("");
                                    }}
                                  >
                                    {t("提交整改验证")}
                                  </Button>
                                )}
                              {verification === r.id && (
                                <form
                                  className={styles.verification}
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void submit({
                                      type: "risk.close",
                                      riskId: r.id,
                                      description: evidence,
                                    });
                                  }}
                                >
                                  <label htmlFor={`${uid}-evidence`}>
                                    {t("整改措施与验证依据")}
                                  </label>
                                  <textarea
                                    id={`${uid}-evidence`}
                                    value={evidence}
                                    disabled={saving}
                                    onChange={(e) =>
                                      setEvidence(e.target.value)
                                    }
                                    required
                                    minLength={4}
                                    maxLength={500}
                                  />
                                  <p className={styles.hint}>
                                    {t(
                                      "人工记录验证依据，不代表系统已重新执行兼容性评估。已生成的批次不会自动追加对象。",
                                    )}
                                  </p>
                                  <div className={styles.editorActions}>
                                    <Button
                                      disabled={saving}
                                      onClick={() => setVerification(null)}
                                    >
                                      {t("取消")}
                                    </Button>
                                    <Button
                                      primary
                                      type="submit"
                                      disabled={
                                        saving || evidence.trim().length < 4
                                      }
                                    >
                                      {t("确认验证结果")}
                                    </Button>
                                  </div>
                                </form>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                </tbody>
              ))}
            </table>
          </div>
          {!visible.length && (
            <p className={styles.empty}>
              {t(
                s.risks.length
                  ? "没有符合条件的风险。"
                  : "完成评估后，在这里查看风险与处理建议。",
              )}
            </p>
          )}
        </div>
        {showEditor && (
          <aside
            className={styles.strategyPane}
            ref={editor}
            tabIndex={-1}
            aria-label={t("风险处置方案")}
          >
            <RiskStrategyEditor
              key={selected.join(",")}
              risks={selectedRisks}
              saving={saving}
              onSubmit={(cmd) => void submit(cmd)}
              onCancel={() => select([])}
            />
          </aside>
        )}
      </div>
    </section>
  );
}
