import { useRef, useState } from "react";
import type { ProjectSnapshot, RiskItem } from "@/domain/models";
import {
  canChangeAssessmentDecision,
  hasRiskDecision,
  migrationScope,
  riskReadyForExecution,
} from "@/domain/assessment";
import type { BulkRiskAction } from "@/domain/risk-decisions";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Select } from "@/shared/ui/Select";
import { Icon } from "@/shared/ui/icons";
import type { PageState } from "@/shared/ui/pagination-state";
import { SelectionCheckbox } from "@/shared/ui/SelectionCheckbox";
import {
  CategoryRiskTable,
  initialCategoryView,
  type CategoryTableView,
} from "./CategoryRiskTable";
import { RiskStrategyDock } from "./RiskStrategyDock";
import { RiskStrategyEditor } from "./RiskStrategyEditor";
import type { RiskInteractions } from "./RiskVmDetails";
import { RiskVmTable } from "./RiskVmTable";
import { RiskBulkToolbar, RiskBulkConfirmation } from "./RiskBulkActions";
import {
  categoryGroups,
  selectionState,
  toggleRiskSelection,
  undecidedRisks,
  vmCount,
  vmGroups,
  type RiskLocation,
} from "./presentation";
import styles from "./RiskPanel.module.css";

type Editing = {
  key: string;
  name?: string;
  ids: number[];
  onlyUndecided: boolean;
  quick?: BulkRiskAction;
};
export interface RiskWorkspaceProps {
  snapshot: ProjectSnapshot;
  location: RiskLocation;
  onLocationChange: (location: RiskLocation) => void;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
}

/** Local interaction state only. Business decisions and execution remain in the service. */
export function RiskWorkspace({
  snapshot: s,
  location,
  onLocationChange,
  onCommand,
  sidePanel = false,
  onManage,
}: RiskWorkspaceProps & {
  sidePanel?: boolean;
  onManage?: (location: RiskLocation) => void;
}) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [categoryViews, setCategoryViews] = useState<
    Record<string, CategoryTableView>
  >({});
  const [vmPage, setVmPage] = useState<PageState>(() => ({
    page:
      Math.floor(
        Math.max(
          0,
          vmGroups(s.risks).findIndex((row) => row.key === location.vmKey),
        ) / 20,
      ) + 1,
    size: 20,
  }));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const submitting = useRef(false);
  const origin = useRef<HTMLElement | null>(null);
  const originKey = useRef<string | undefined>(undefined);
  const actionRegion = useRef<HTMLDivElement>(null);
  const scopeLocked = saving || !!editing;
  const editingRisks = editing
    ? s.risks.filter((r) => editing.ids.includes(r.id))
    : [];
  function beginEditing(next: Editing) {
    if (saving || editing) return;
    origin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    originKey.current = origin.current?.dataset.riskTrigger;
    setFeedback("");
    setFailed(false);
    setEditing(next);
  }
  function finishEditing() {
    setEditing(null);
    requestAnimationFrame(() => {
      const target = origin.current?.isConnected
        ? origin.current
        : originKey.current
          ? actionRegion.current?.querySelector<HTMLElement>(
              `[data-risk-trigger="${originKey.current}"]`,
            )
          : null;
      if (target?.isConnected && !target.matches(":disabled"))
        target.focus({ preventScroll: true });
      else actionRegion.current?.focus({ preventScroll: true });
      origin.current = null;
      originKey.current = undefined;
    });
  }
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
      (
        risk.description +
        " " +
        t(risk.description) +
        " " +
        risk.vmName +
        " " +
        risk.vmId +
        " " +
        (risk.rule ?? "")
      )
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const categories = categoryGroups(visible);
  const category =
    categories.find((c) => c.key === location.category) ?? categories[0];
  const mode = sidePanel ? "category" : location.mode;
  const filtersActive = !!query || level !== "all" || status !== "all";
  const available = visible.filter((r) => r.stage === "research");
  const selectedRisks = available.filter((r) => selected.has(r.id));

  function clearSelection() {
    setSelected(new Set());
    setEditing(null);
    setFeedback("");
  }
  function resetFilters() {
    clearSelection();
    setCategoryViews({});
    setVmPage({ ...vmPage, page: 1 });
    onLocationChange({ ...location, vmKey: undefined });
  }
  function navigate(next: RiskLocation) {
    if (saving || (editing && next.mode !== mode)) return;
    if (!editing) setFeedback("");
    if (next.mode !== mode) setSelected(new Set());
    onLocationChange(next);
  }
  function select(risks: RiskItem[], checked: boolean) {
    if (scopeLocked || !editable) return;
    setSelected((current) => toggleRiskSelection(current, risks, checked));
    setEditing(null);
    setFeedback("");
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
    if (ok) {
      if (editing) finishEditing();
      setSelected(new Set());
    }
    return ok;
  }
  const interactions: RiskInteractions = {
    editable,
    saving,
    editing: !!editing,
    onManage,
    onCommand: submit,
    onEdit: (key, risks, onlyUndecided = false) => {
      beginEditing({
        key,
        name: key.startsWith("vm:") ? risks[0]?.vmName : risks[0]?.description,
        ids: risks.filter((r) => r.stage === "research").map((r) => r.id),
        onlyUndecided,
      });
    },
  };

  return (
    <div className={styles.workspace} data-side-panel={sidePanel}>
      <div className={styles.workspaceHeader}>
        <div className={styles.summaryRow}>
          <div className={styles.overview}>
            <span>
              {t("可纳入")} <strong>{included}</strong>
            </span>
            <span>
              {t("暂时排除")}{" "}
              <strong data-tone="warning">
                {s.scopeRows.length - included}
              </strong>
            </span>
            <span>
              {t("未选策略")}{" "}
              <strong>
                {s.risks.filter((r) => !hasRiskDecision(r)).length}
              </strong>
            </span>
          </div>
          <span
            className={styles.scopeHint}
            title={t("风险可稍后处理，受阻对象不会进入实施。")}
          >
            {t("受阻对象自动排除")}
          </span>
          {!sidePanel && (
            <div
              className={styles.modeSwitch}
              role="group"
              aria-label={t("风险查看方式")}
            >
              <button
                aria-pressed={mode === "category"}
                disabled={scopeLocked}
                onClick={() => navigate({ ...location, mode: "category" })}
              >
                {t("按类别")}
              </button>
              <button
                aria-pressed={mode === "vm"}
                disabled={scopeLocked}
                onClick={() => navigate({ ...location, mode: "vm" })}
              >
                {t("按虚拟机")}
              </button>
            </div>
          )}
        </div>
        <div className={styles.filters}>
          <label className={styles.search}>
            <Icon name="search" size={16} />
            <input
              value={query}
              disabled={scopeLocked}
              onChange={(e) => {
                setQuery(e.target.value);
                resetFilters();
              }}
              placeholder={t("搜索风险、规则或虚拟机")}
              aria-label={t("搜索风险、规则或虚拟机")}
            />
          </label>
          <Select
            value={level}
            disabled={scopeLocked}
            onValueChange={(value) => {
              setLevel(value);
              resetFilters();
            }}
            aria-label={t("风险级别")}
          >
            <option value="all">{t("全部级别")}</option>
            {(["high", "medium", "low"] as const).map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            disabled={scopeLocked}
            onValueChange={(value) => {
              setStatus(value);
              resetFilters();
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
      </div>
      <div
        ref={actionRegion}
        className={styles.dock}
        data-editing={!!editing}
        tabIndex={-1}
        role="region"
        aria-label={t("策略操作区")}
      >
        {editing ? (
          <RiskStrategyDock
            key={editing.key}
            title={
              editing.key === "bulk"
                ? t("批量设置策略")
                : editing.key.startsWith("vm:")
                  ? t("虚拟机：{0}", editing.name ?? "")
                  : t("风险事项：{0}", t(editing.name ?? ""))
            }
          >
            {editing.quick ? (
              <RiskBulkConfirmation
                snapshot={s}
                risks={editingRisks}
                action={editing.quick}
                saving={saving}
                locked={!editable}
                feedback={failed ? t(feedback) : undefined}
                onSubmit={(cmd) => void submit(cmd)}
                onCancel={finishEditing}
              />
            ) : (
              <RiskStrategyEditor
                risks={editingRisks}
                onlyUndecided={editing.onlyUndecided}
                saving={saving}
                locked={!editable}
                feedback={failed ? t(feedback) : undefined}
                onSubmit={(cmd) => void submit(cmd)}
                onCancel={finishEditing}
              />
            )}
          </RiskStrategyDock>
        ) : (
          <>
            <RiskBulkToolbar
              selected={selectedRisks}
              available={available}
              saving={saving}
              editable={editable}
              onClear={clearSelection}
              onAction={(action) => {
                beginEditing({
                  key: "bulk",
                  ids: (selectedRisks.length ? selectedRisks : available).map(
                    (r) => r.id,
                  ),
                  onlyUndecided: true,
                  quick: action === "custom" ? undefined : action,
                });
              }}
            />
            {feedback && (
              <p
                role={failed ? "alert" : "status"}
                className={failed ? styles.error : styles.feedback}
              >
                {t(feedback)}
              </p>
            )}
          </>
        )}
      </div>
      <div
        className={styles.listViewport}
        role="region"
        aria-label={t("风险浏览区")}
        tabIndex={0}
      >
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
              <label className={styles.selectAllCategories}>
                <SelectionCheckbox
                  label={t("全选所有大类")}
                  {...selectionState(available, selected)}
                  disabled={!editable || scopeLocked || !available.length}
                  onChange={(checked) => select(available, checked)}
                />
                {t("全选所有大类")}
              </label>
              <div className={styles.categoryItems}>
                {categories.map((group) => (
                  <div
                    className={styles.categoryItem}
                    key={group.key}
                    data-current={category?.key === group.key}
                  >
                    <SelectionCheckbox
                      label={t("选择大类 {0}", t(group.label))}
                      {...selectionState(group.risks, selected)}
                      disabled={
                        !editable ||
                        scopeLocked ||
                        !group.risks.some((r) => r.stage === "research")
                      }
                      onChange={(checked) => select(group.risks, checked)}
                    />
                    <button
                      disabled={saving}
                      aria-current={
                        category?.key === group.key ? "true" : undefined
                      }
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
                  </div>
                ))}
              </div>
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
                      {filtersActive && " · " + t("当前筛选结果")}
                    </p>
                  </div>
                </div>
                <CategoryRiskTable
                  key={category.key}
                  risks={category.risks}
                  allRisks={s.risks}
                  readOnlyVms={sidePanel}
                  selected={selected}
                  onSelect={select}
                  view={categoryViews[category.key] ?? initialCategoryView()}
                  onView={(view) =>
                    setCategoryViews((current) => ({
                      ...current,
                      [category.key]: view,
                    }))
                  }
                  {...interactions}
                />
              </section>
            )}
          </div>
        ) : (
          <div>
            <div className={styles.tableSelection}>
              <span>
                {t(
                  "风险数与处理进度按当前筛选结果统计；迁移资格按全部项目风险计算。",
                )}
              </span>
              <button
                className={styles.textAction}
                disabled={!editable || scopeLocked || !available.length}
                onClick={() => select(available, true)}
              >
                {t("选择全部 {0} 台虚拟机（含所有页）", vmCount(available))}
              </button>
            </div>
            <RiskVmTable
              risks={visible}
              allRisks={s.risks}
              selected={selected}
              onSelect={select}
              label={t("虚拟机风险列表")}
              pagination={vmPage}
              onPage={setVmPage}
              expandedVm={location.vmKey}
              onExpandVm={(vmKey) =>
                navigate({ ...location, mode: "vm", vmKey })
              }
              {...interactions}
            />
          </div>
        )}
      </div>
    </div>
  );
}
