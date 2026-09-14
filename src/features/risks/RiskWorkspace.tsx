import { Fragment, useEffect, useRef, useState } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import {
  canChangeAssessmentDecision,
  hasRiskDecision,
  migrationScope,
  riskReadyForExecution,
} from "@/domain/assessment";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Select } from "@/shared/ui/Select";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { CategoryRiskTable } from "./CategoryRiskTable";
import { RiskStrategyEditor } from "./RiskStrategyEditor";
import { RiskVmDetails, type RiskInteractions } from "./RiskVmDetails";
import {
  categoryGroups,
  undecidedRisks,
  vmCount,
  vmGroups,
  vmKey,
  type RiskLocation,
} from "./presentation";
import styles from "./RiskPanel.module.css";

type Editing = { key: string; ids: number[]; onlyUndecided: boolean };
export interface RiskWorkspaceProps {
  snapshot: ProjectSnapshot;
  location: RiskLocation;
  onLocationChange: (location: RiskLocation) => void;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
}

/** Category handling is shared; only the management surface exposes per-VM editing. */
export function RiskWorkspace({
  snapshot: s,
  location,
  onLocationChange,
  onCommand,
  drawer = false,
  onManage,
}: RiskWorkspaceProps & {
  drawer?: boolean;
  onManage?: (location: RiskLocation) => void;
}) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const submitting = useRef(false);
  const editable = canChangeAssessmentDecision(s);
  const included = migrationScope(s).length;
  const visible = s.risks.filter(
    (risk) =>
      (level === "all" || risk.level === level) &&
      (status === "all" ||
        (status === "undecided"
          ? !hasRiskDecision(risk)
          : status === "excluded"
            ? !riskReadyForExecution(risk)
            : hasRiskDecision(risk))) &&
      `${risk.description} ${t(risk.description)} ${risk.vmName} ${risk.vmId} ${risk.rule ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const categories = categoryGroups(visible);
  const category =
    categories.find((c) => c.key === location.category) ?? categories[0];
  const mode = drawer ? "category" : location.mode;
  const filtersActive = !!query || level !== "all" || status !== "all";
  const selectedVmRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (mode === "vm" && location.vmKey) {
      selectedVmRow.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
    }
  }, [mode, location.vmKey]);

  function navigate(next: RiskLocation) {
    if (saving) return;
    setEditing(null);
    setFeedback("");
    onLocationChange(next);
  }
  async function submit(cmd: ProjectCommand) {
    if (submitting.current) return false;
    submitting.current = true;
    setSaving(true);
    setFeedback("");
    setFailed(false);
    let ok = false;
    try {
      ok = await onCommand(cmd);
    } catch {
      ok = false;
    } finally {
      submitting.current = false;
      setSaving(false);
    }
    setFailed(!ok);
    setFeedback(
      ok
        ? "已保存，处置说明已同步到发起会话。"
        : "保存失败，请检查最新风险状态或稍后重试。输入已保留。",
    );
    if (ok) setEditing(null);
    return ok;
  }
  const interactions: RiskInteractions = {
    editable,
    saving,
    onManage,
    onCommand: submit,
    onEdit: (key, risks, onlyUndecided = false) => {
      if (saving) return;
      setFeedback("");
      setFailed(false);
      setEditing({
        key,
        ids: risks.filter((r) => r.stage === "research").map((r) => r.id),
        onlyUndecided,
      });
    },
    editorFor: (key) => {
      if (!editing || editing.key !== key || !editable) return null;
      return (
        <div className={styles.inlineEditor}>
          <RiskStrategyEditor
            key={`${key}:${editing.ids.join(",")}`}
            risks={s.risks.filter((r) => editing.ids.includes(r.id))}
            onlyUndecided={editing.onlyUndecided}
            saving={saving}
            onSubmit={(cmd) => void submit(cmd)}
            onCancel={() => setEditing(null)}
          />
          {failed && (
            <p role="alert" className={styles.error}>
              {t(feedback)}
            </p>
          )}
        </div>
      );
    },
  };
  return (
    <div className={styles.workspace} data-drawer={drawer}>
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
      <p className={styles.hint}>
        {t("风险可稍后处理，受阻对象不会进入实施。")}
      </p>
      {!drawer && (
        <div
          className={styles.modeSwitch}
          role="group"
          aria-label={t("风险查看方式")}
        >
          <button
            aria-pressed={mode === "category"}
            disabled={saving}
            onClick={() => navigate({ ...location, mode: "category" })}
          >
            {t("按类别")}
          </button>
          <button
            aria-pressed={mode === "vm"}
            disabled={saving}
            onClick={() => navigate({ ...location, mode: "vm" })}
          >
            {t("按虚拟机")}
          </button>
        </div>
      )}
      <div className={styles.filters}>
        <label className={styles.search}>
          <Icon name="search" size={16} />
          <input
            value={query}
            disabled={saving}
            onChange={(e) => {
              setQuery(e.target.value);
              setEditing(null);
            }}
            placeholder={t("搜索风险、规则或虚拟机")}
            aria-label={t("搜索风险、规则或虚拟机")}
          />
        </label>
        <Select
          value={level}
          disabled={saving}
          onValueChange={(value) => {
            setLevel(value);
            setEditing(null);
          }}
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
          disabled={saving}
          onValueChange={(value) => {
            setStatus(value);
            setEditing(null);
          }}
          aria-label={t("处置状态")}
        >
          <option value="all">{t("全部状态")}</option>
          <option value="undecided">{t("未选策略")}</option>
          <option value="excluded">{t("暂时排除")}</option>
          <option value="decided">{t("已选策略")}</option>
        </Select>
      </div>
      {!editable && !!s.risks.length && (
        <p className={styles.hint}>
          {t(
            s.assessmentStatus === "completed"
              ? "实施准备已开始，策略已锁定；仍可补充验证记录。"
              : "评估完成后可选择策略。",
          )}
        </p>
      )}
      {feedback && !editing && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? styles.error : styles.feedback}
        >
          {t(feedback)}
        </p>
      )}
      {!visible.length ? (
        <p className={styles.empty}>
          {t(
            s.risks.length
              ? "没有符合条件的风险。"
              : "完成评估后，在这里查看风险与处理建议。",
          )}
        </p>
      ) : mode === "category" ? (
        <div className={styles.categoryLayout}>
          <nav className={styles.categories} aria-label={t("风险类别")}>
            {categories.map((group) => (
              <button
                key={group.key}
                disabled={saving}
                aria-current={category?.key === group.key ? "true" : undefined}
                onClick={() =>
                  navigate({ mode: "category", category: group.key })
                }
              >
                <strong>{t(group.label)}</strong>
                <small>
                  {t(
                    "{0} 台 · 未选 {1} 项",
                    vmCount(group.risks),
                    undecidedRisks(group.risks).length,
                  )}
                </small>
              </button>
            ))}
          </nav>
          {category && (
            <section
              className={styles.categoryBody}
              aria-label={t(category.label)}
            >
              <div className={styles.sectionHeading}>
                <div>
                  <h3>{t(category.label)}</h3>
                  <p>
                    {t(
                      "{0} 条风险 · {1} 台虚拟机",
                      category.risks.length,
                      vmCount(category.risks),
                    )}
                    {filtersActive && ` · ${t("当前筛选结果")}`}
                  </p>
                </div>
                <Button
                  disabled={
                    !editable ||
                    saving ||
                    !undecidedRisks(category.risks).length
                  }
                  onClick={() =>
                    interactions.onEdit(
                      `category:${category.key}`,
                      category.risks,
                      true,
                    )
                  }
                >
                  {t("批量设置策略")}
                </Button>
              </div>
              {!undecidedRisks(category.risks).length && (
                <p className={styles.hint}>
                  {t("本类没有未选策略的评估风险，已有选择已保留。")}
                </p>
              )}
              {interactions.editorFor(`category:${category.key}`)}
              <CategoryRiskTable
                key={category.key}
                risks={category.risks}
                drawer={drawer}
                {...interactions}
              />
            </section>
          )}
        </div>
      ) : (
        <div
          className={styles.tableScroll}
          role="region"
          tabIndex={0}
          aria-label={t("虚拟机风险列表")}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("虚拟机")}</th>
                <th>{t("风险数")}</th>
                <th>{t("迁移资格")}</th>
                <th>{t("处理状态")}</th>
              </tr>
            </thead>
            <tbody>
              {vmGroups(visible).map(({ key, risks }) => {
                const open = location.vmKey === key;
                const all = s.risks.filter((r) => vmKey(r) === key);
                const eligible = all.every(riskReadyForExecution);
                return (
                  <Fragment key={key}>
                    <tr
                      data-selected={open}
                      ref={open ? selectedVmRow : undefined}
                    >
                      <th scope="row">
                        <button
                          className={styles.textAction}
                          disabled={saving}
                          aria-expanded={open}
                          onClick={() =>
                            navigate({
                              ...location,
                              mode: "vm",
                              vmKey: open ? undefined : key,
                            })
                          }
                        >
                          <Icon name={open ? "chevron" : "right"} size={13} />
                          {risks[0].vmName}
                        </button>
                        <small>{risks[0].vmId}</small>
                      </th>
                      <td>{risks.length}</td>
                      <td>
                        <span
                          className={styles.impact}
                          data-impact={eligible ? "constraint" : "blocked"}
                        >
                          {t(eligible ? "可纳入" : "暂时排除")}
                        </span>
                      </td>
                      <td>
                        {t(
                          "已选 {0} / {1}",
                          risks.filter(hasRiskDecision).length,
                          risks.length,
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className={styles.expandedRow}>
                        <td colSpan={4}>
                          <div className={styles.sectionHeading}>
                            <p>
                              {t("批量调整将更新这台虚拟机的所选风险策略。")}
                              {filtersActive && ` ${t("仅针对当前筛选结果。")}`}
                            </p>
                            <Button
                              disabled={
                                !editable ||
                                saving ||
                                !risks.some((r) => r.stage === "research")
                              }
                              onClick={() =>
                                interactions.onEdit(`vm:${key}`, risks)
                              }
                            >
                              {t("批量调整策略")}
                            </Button>
                          </div>
                          {interactions.editorFor(`vm:${key}`)}
                          <RiskVmDetails risks={risks} {...interactions} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
