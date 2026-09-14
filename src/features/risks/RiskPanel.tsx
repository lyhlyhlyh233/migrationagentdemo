import { useId, useRef, useState } from "react";
import type {
  ProjectSnapshot,
  RiskItem,
  RiskStrategy,
  MigrationMethod,
} from "@/domain/models";
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
  const editor = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState("category");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [strategy, setStrategy] = useState<RiskStrategy>("remediate");
  const [method, setMethod] = useState<MigrationMethod>("agentless");
  const [note, setNote] = useState("");
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
  function select(ids: number[]) {
    setSelected(ids);
    setFeedback("");
    setVerification(null);
  }
  function edit(r: RiskItem) {
    select([r.id]);
    setStrategy(r.decision?.strategy ?? r.recommendedStrategy ?? "remediate");
    setMethod(r.decision?.method ?? r.recommendedMethod ?? "agentless");
    setNote(r.decision?.note ?? r.recommendation ?? "");
    requestAnimationFrame(() =>
      editor.current?.scrollIntoView({ block: "nearest", behavior: "instant" }),
    );
  }
  async function submit(cmd: ProjectCommand) {
    setSaving(true);
    setFeedback("");
    const ok = await onCommand(cmd);
    setSaving(false);
    if (ok) {
      setSelected([]);
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
            disabled={!editable || !selectable.length}
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
          <Button onClick={() => select([])}>{t("清空选择")}</Button>
        )}
      </div>
      {!editable && s.risks.length > 0 && (
        <p className={styles.hint}>
          {t("实施准备已开始，策略已锁定；仍可补充验证记录。")}
        </p>
      )}
      <div ref={editor}>
        {!!selected.length && editable && (
          <form
            className={styles.editor}
            onSubmit={(e) => {
              e.preventDefault();
              void submit({
                type: "risk.decide",
                riskIds: selected,
                decision: {
                  strategy,
                  method: strategy === "exclude" ? "manual" : method,
                  note,
                },
              });
            }}
          >
            <div className={styles.editorTitle}>
              <strong>{t("为所选 {0} 项选择策略", selected.length)}</strong>
              <Button
                disabled={saving}
                onClick={() =>
                  void submit({ type: "risk.recommend", riskIds: selected })
                }
              >
                {t("分别采用建议")}
              </Button>
            </div>
            <div className={styles.choices}>
              <label>
                {t("处置方式")}
                <Select
                  value={strategy}
                  onValueChange={(value) => {
                    setStrategy(value as RiskStrategy);
                    if (value === "exclude") setMethod("manual");
                    else if (value !== "custom" && method === "manual")
                      setMethod("agentless");
                  }}
                  aria-label={t("处置方式")}
                >
                  {(Object.keys(riskStrategyLabels) as RiskStrategy[]).map(
                    (v) => (
                      <option
                        key={v}
                        value={v}
                        disabled={
                          v === "ignore" &&
                          selectedRisks.some((r) => r.impact !== "constraint")
                        }
                      >
                        {t(riskStrategyLabels[v])}
                      </option>
                    ),
                  )}
                </Select>
              </label>
              {strategy !== "exclude" && (
                <label>
                  {t("迁移方式")}
                  <Select
                    value={method}
                    onValueChange={(v) => setMethod(v as MigrationMethod)}
                    aria-label={t("迁移方式")}
                  >
                    {(
                      Object.keys(migrationMethodLabels) as MigrationMethod[]
                    ).map((v) => (
                      <option
                        key={v}
                        value={v}
                        disabled={v === "manual" && strategy !== "custom"}
                      >
                        {t(migrationMethodLabels[v])}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </div>
            <p className={styles.hint}>
              {t(
                strategy === "ignore"
                  ? "仅接受可迁对象的约束，不会把不兼容或待整改对象改为可迁。"
                  : strategy === "remediate"
                    ? "记录整改计划后仍暂时排除，提交验证依据后再重新核对范围。"
                    : strategy === "exclude"
                      ? "所选风险关联的虚拟机退出本次工具范围，其他风险记录仍保留。"
                      : "写明具体方案与验证要求；另行迁移或重建的对象不进入工具任务。",
              )}
            </p>
            <label htmlFor={`${uid}-note`}>{t("策略说明")}</label>
            <textarea
              id={`${uid}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("说明采用的方案、约束或验证要求（4 至 500 字）")}
              required
              minLength={4}
              maxLength={500}
            />
            <div className={styles.editorActions}>
              <Button onClick={() => select([])} disabled={saving}>
                {t("取消")}
              </Button>
              <Button
                primary
                type="submit"
                disabled={
                  saving ||
                  note.trim().length < 4 ||
                  (strategy === "ignore" &&
                    selectedRisks.some((r) => r.impact !== "constraint"))
                }
              >
                {t(saving ? "保存中…" : "保存策略并记录对话")}
              </Button>
            </div>
          </form>
        )}
      </div>
      {feedback && (
        <p role="status" className={styles.hint}>
          {t(feedback)}
        </p>
      )}
      <div className={styles.groups}>
        {[...groups].map(([name, risks]) => (
          <details key={name} open className={styles.group}>
            <summary>
              {t(name)} <span>{risks.length}</span>
            </summary>
            {editable && risks.some((r) => r.stage === "research") && (
              <button
                type="button"
                className={styles.selectGroup}
                onClick={() =>
                  select([
                    ...new Set([
                      ...selected,
                      ...risks
                        .filter((r) => r.stage === "research")
                        .map((r) => r.id),
                    ]),
                  ])
                }
              >
                {t("选择此组")}
              </button>
            )}
            {risks.map((r) => (
              <article key={r.id} className={styles.risk}>
                <div className={styles.riskHeading}>
                  {r.stage === "research" && (
                    <input
                      type="checkbox"
                      aria-label={t("选择 {0}", t(r.description))}
                      disabled={!editable}
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
                  <strong>{t(r.description)}</strong>
                  <span className={styles.severity} data-level={r.level}>
                    {t(r.level)}
                  </span>
                </div>
                <div className={styles.meta}>
                  <span>R-{r.id}</span>
                  <span>{r.vmName}</span>
                  {r.impact && (
                    <span data-impact={r.impact}>
                      {t(riskImpactLabels[r.impact])}
                    </span>
                  )}
                  <span>
                    {t(riskReadyForExecution(r) ? "可纳入" : "暂时排除")}
                  </span>
                </div>
                {r.recommendation && (
                  <p className={styles.recommendation}>{t(r.recommendation)}</p>
                )}
                <details className={styles.evidence}>
                  <summary>{t("规则依据与原始发现")}</summary>
                  <p>{t(r.rule ?? "规划风险")}</p>
                  <p>{t(r.evidence ?? r.description)}</p>
                </details>
                <div className={styles.decision}>
                  <span>
                    {t(
                      r.closed
                        ? "整改已验证"
                        : r.decision
                          ? riskStrategyLabels[r.decision.strategy]
                          : "未选策略",
                    )}
                    {r.decision &&
                      ` · ${t(migrationMethodLabels[r.decision.method])}`}
                  </span>
                  {r.stage === "research" && editable && (
                    <Button onClick={() => edit(r)}>
                      {t(r.decision ? "调整策略" : "选择策略")}
                    </Button>
                  )}
                  {!r.closed &&
                    !excludedFromTool(r) &&
                    (r.stage !== "research" ||
                      (r.decision &&
                        ["remediate", "custom"].includes(
                          r.decision.strategy,
                        ))) && (
                      <Button
                        onClick={() => {
                          setVerification(r.id);
                          setEvidence("");
                        }}
                      >
                        {t("提交整改验证")}
                      </Button>
                    )}
                </div>
                {r.decision?.note && r.decision.note !== r.recommendation && (
                  <p className={styles.hint}>{t(r.decision.note)}</p>
                )}
                {r.closed && (
                  <p className={styles.hint}>{t(r.closureDescription)}</p>
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
                      onChange={(e) => setEvidence(e.target.value)}
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
                      <Button onClick={() => setVerification(null)}>
                        {t("取消")}
                      </Button>
                      <Button
                        primary
                        type="submit"
                        disabled={saving || evidence.trim().length < 4}
                      >
                        {t("确认验证结果")}
                      </Button>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </details>
        ))}
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
    </section>
  );
}
