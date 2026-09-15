import { Fragment, useState } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import { canValidate } from "@/domain/execution";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import type { ValidationView } from "@/features/migration/state";
import { Button } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/Select";
import { Pagination } from "@/shared/ui/Pagination";
import { pageWindow } from "@/shared/ui/pagination-state";
import { useTranslation } from "@/shared/i18n";
import styles from "@/features/migration/Execution.module.css";
export function ValidationWorkspace({
  snapshot: s,
  view: v,
  onView,
  onCommand,
  onDownload,
  onUpload,
  onReturn,
  onContext,
}: {
  snapshot: ProjectSnapshot;
  view: ValidationView;
  onView: (patch: Partial<ValidationView>) => void;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onDownload: (id: string) => void;
  onUpload: (p: FilePurpose, f: File) => Promise<boolean>;
  onReturn: () => void;
  onContext?: (label: string) => void;
}) {
  const t = useTranslation(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [finalConfirm, setFinalConfirm] = useState(false);
  const e = s.execution;
  async function send(cmd: ProjectCommand) {
    setBusy(true);
    setError(false);
    try {
      const ok = await onCommand(cmd);
      setError(!ok);
      if (ok) {
        onView({
          editor: "",
          selected: [],
          note: "",
          feedbackId: "",
          feedbackRevision: undefined,
        });
        setFinalConfirm(false);
      }
      return ok;
    } finally {
      setBusy(false);
    }
  }
  if (!e || !s.enteredStages.includes("validation"))
    return (
      <section className={styles.root}>
        <div className={styles.empty}>
          <p>{t("首批割接完成后，请人工确认进入结果验证。")}</p>
          <div className={styles.toolbar}>
            <Button
              onClick={() =>
                void onCommand({ type: "stage.review", target: "validation" })
              }
            >
              {t("查看验证交接条件")}
            </Button>
            <Button onClick={onReturn}>{t("返回迁移实施")}</Button>
          </div>
        </div>
      </section>
    );
  const taskMap = new Map(e.tasks.map((task) => [task.id, task]));
  const rows = e.validations.map((val) => ({
    val,
    task: taskMap.get(val.taskId)!,
  }));
  const group = (task: (typeof rows)[number]["task"]) =>
    v.group === "batch"
      ? task.batchId
      : task.system || `${t("未填写业务系统")} · ${task.batchId}`;
  const groups = [...new Set(rows.map((r) => group(r.task)))];
  const filtered = rows.filter(
    (r) =>
      (!v.scope || group(r.task) === v.scope) &&
      (!v.status || r.val.business === v.status) &&
      `${r.task.name} ${r.task.assetId} ${r.task.system} ${r.task.batchId}`
        .toLowerCase()
        .includes(v.query.toLowerCase()),
  );
  const range = pageWindow(filtered.length, { page: v.page, size: v.size }),
    page = filtered.slice(range.start, range.end),
    pageIds = page.map((r) => r.task.id);
  const selected = rows.filter((r) => v.selected.includes(r.task.id));
  const locked = busy || !!v.editor || e.finalized;
  const reset = (patch: Partial<ValidationView>) =>
    onView({ ...patch, page: 1, selected: [] });
  const toggle = (ids: string[], checked: boolean) =>
    onView({
      selected: checked
        ? [...new Set([...v.selected, ...ids])]
        : v.selected.filter((id) => !ids.includes(id)),
    });
  const statusLabel = {
      pending: "待验证",
      passed: "业务通过",
      failed: "业务不通过",
    },
    techLabel = {
      matched: "核对通过",
      different: "存在差异",
      accepted: "差异已接受",
    };
  return (
    <section className={styles.root} aria-label={t("结果验证工作区")}>
      <header className={styles.header}>
        <div>
          <h2>{t("结果验证")}</h2>
          <small>
            {t(e.finalized ? "最终交付已确认" : "阶段性结果 · 模拟核对")}
          </small>
        </div>
        <Button onClick={onReturn}>{t("返回迁移实施")}</Button>
      </header>
      <div className={styles.body}>
        <div className={styles.summary}>
          <span>
            {t("纳入")}
            <strong>{e.tasks.length}</strong>
          </span>
          <span>
            {t("割接完成")}
            <strong>{rows.length}</strong>
          </span>
          <span>
            {t("业务通过")}
            <strong data-tone="success">
              {rows.filter((r) => r.val.business === "passed").length}
            </strong>
          </span>
          <span>
            {t("待验证")}
            <strong data-tone="warning">
              {rows.filter((r) => r.val.business === "pending").length}
            </strong>
          </span>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {t("操作未完成，输入与选择已保留。请根据提示调整后重试。")}
          </p>
        )}
        <div className={styles.toolbar}>
          <Select
            value={v.group}
            disabled={locked}
            onValueChange={(group) =>
              reset({ group: group as ValidationView["group"], scope: "" })
            }
          >
            <option value="batch">{t("按批次")}</option>
            <option value="system">{t("按业务系统")}</option>
          </Select>
          <Select
            aria-label={t("验证范围")}
            value={v.scope}
            disabled={locked}
            onValueChange={(scope) => {
              reset({ scope });
              onContext?.(scope);
            }}
          >
            <option value="">{t("全部范围")}</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          <Select
            value={v.status}
            disabled={locked}
            onValueChange={(status) => reset({ status })}
          >
            <option value="">{t("全部状态")}</option>
            {Object.entries(statusLabel).map(([key, label]) => (
              <option key={key} value={key}>
                {t(label)}
              </option>
            ))}
          </Select>
          <input
            type="search"
            value={v.query}
            disabled={locked}
            onChange={(x) => reset({ query: x.target.value })}
            placeholder={t("搜索批次、虚拟机或业务系统")}
          />
        </div>
        <div className={styles.toolbar}>
          <span>{t("已选 {0} 台虚拟机", selected.length)}</span>
          <Button
            disabled={locked}
            onClick={() =>
              toggle(
                filtered.map((r) => r.task.id),
                true,
              )
            }
          >
            {t("选择全部筛选结果")}
          </Button>
          <Button disabled={locked} onClick={() => onView({ selected: [] })}>
            {t("清空选择")}
          </Button>
        </div>
        <div className={styles.toolbar}>
          <Button
            primary
            disabled={locked || !selected.length}
            onClick={() =>
              onView({ editor: "record", editorRevision: e.revision, note: "" })
            }
          >
            {t("批量业务验证")}
          </Button>
          <Button
            disabled={
              locked ||
              !selected.length ||
              selected.some((r) => r.val.technical !== "different")
            }
            onClick={() =>
              onView({
                editor: "difference",
                editorRevision: e.revision,
                note: "",
              })
            }
          >
            {t("接受预期差异")}
          </Button>
          <Button
            disabled={locked}
            onClick={() =>
              onView({
                editor: "feedback",
                editorRevision: e.revision,
                note: "",
              })
            }
          >
            {t("反馈问题")}
          </Button>
          <Button onClick={() => onDownload("validation-report")}>
            {t("下载验证汇总")}
          </Button>
        </div>
        {v.editor && (
          <section className={styles.editor}>
            <h3>
              {t(
                {
                  record: "确认业务验证",
                  difference: "接受预期差异",
                  feedback: "提交迁移反馈",
                }[v.editor],
              )}
            </h3>
            <p>
              {v.editor === "feedback" && !selected.length
                ? t("未选择对象：反馈关联本次迁移全部纳入范围。")
                : t("本次仅处理所选 {0} 台虚拟机", selected.length)}
            </p>
            {v.editor === "record" && (
              <div className={styles.options}>
                {(["passed", "failed", "pending"] as const).map((status) => (
                  <label key={status}>
                    <input
                      type="radio"
                      name="validation-result"
                      checked={v.result === status}
                      disabled={
                        status === "passed" &&
                        selected.some((r) => !canValidate(e, r.val))
                      }
                      onChange={() => onView({ result: status })}
                    />
                    {t(statusLabel[status])}
                  </label>
                ))}
              </div>
            )}
            {v.editor === "record" &&
              selected.some((r) => !canValidate(e, r.val)) && (
                <p className={`${styles.notice} ${styles.warning}`}>
                  {t("所选范围仍有技术差异或未解决问题，暂不能批量通过。")}
                </p>
              )}
            {v.editor === "feedback" && (
              <label>
                <input
                  type="checkbox"
                  checked={v.blocking}
                  onChange={(x) => onView({ blocking: x.target.checked })}
                />{" "}
                {t("影响业务，需处理后重新验证")}
              </label>
            )}
            <label className={styles.field}>
              {t(
                v.editor === "difference"
                  ? "预期变更与接受原因"
                  : v.editor === "feedback"
                    ? "问题描述"
                    : "验证说明",
              )}
              <textarea
                value={v.note}
                onChange={(x) => onView({ note: x.target.value })}
              />
            </label>
            {v.editorRevision !== undefined &&
              v.editorRevision !== e.revision && (
                <p className={styles.notice} role="status">
                  {t("验证状态已更新，请核对最新结果后重新提交")}{" "}
                  <Button
                    onClick={() => onView({ editorRevision: e.revision })}
                  >
                    {t("已核对最新状态")}
                  </Button>
                </p>
              )}
            <div className={styles.actions}>
              <Button disabled={busy} onClick={() => onView({ editor: "" })}>
                {t("取消")}
              </Button>
              <Button
                primary
                disabled={
                  busy ||
                  (v.editor !== "record" && v.note.trim().length < 4) ||
                  (v.editor === "record" &&
                    v.result === "passed" &&
                    selected.some((r) => !canValidate(e, r.val)))
                }
                onClick={() =>
                  void send(
                    v.editor === "record"
                      ? {
                          type: "validation.record",
                          expectedRevision: v.editorRevision,
                          taskIds: v.selected,
                          status: v.result,
                          note: v.note,
                        }
                      : v.editor === "difference"
                        ? {
                            type: "validation.acceptDifference",
                            expectedRevision: v.editorRevision,
                            taskIds: v.selected,
                            note: v.note,
                          }
                        : {
                            type: "validation.feedback",
                            expectedRevision: v.editorRevision,
                            taskIds: v.selected,
                            description: v.note,
                            blocking: v.blocking,
                          },
                  )
                }
              >
                {t("确认提交")}
              </Button>
            </div>
          </section>
        )}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label={t("选择本页")}
                  disabled={locked}
                  checked={
                    !!pageIds.length &&
                    pageIds.every((id) => v.selected.includes(id))
                  }
                  onChange={(x) => toggle(pageIds, x.target.checked)}
                />
              </th>
              <th>{t("虚拟机 / 业务系统")}</th>
              <th>{t("技术核对")}</th>
              <th>{t("业务验证")}</th>
              <th>{t("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {page.map(({ task: x, val }) => (
              <Fragment key={x.id}>
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={t("选择 {0}", x.name)}
                      disabled={locked}
                      checked={v.selected.includes(x.id)}
                      onChange={(event) => toggle([x.id], event.target.checked)}
                    />
                  </td>
                  <td data-label={t("虚拟机")}>
                    <strong>{x.name}</strong>
                    <small>
                      {x.batchId} · {x.system || t("未填写业务系统")}
                    </small>
                  </td>
                  <td data-label={t("技术核对")}>
                    <span
                      data-tone={
                        val.technical === "different" ? "warning" : "success"
                      }
                    >
                      {t(techLabel[val.technical])}
                    </span>
                  </td>
                  <td data-label={t("业务验证")}>
                    <span
                      data-tone={
                        val.business === "passed"
                          ? "success"
                          : val.business === "failed"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {t(statusLabel[val.business])}
                    </span>
                  </td>
                  <td>
                    <Button
                      onClick={() => {
                        onView({ expanded: v.expanded === x.id ? "" : x.id });
                        onContext?.(`${x.batchId} · ${x.name}`);
                      }}
                    >
                      {t("查看详情")}
                    </Button>
                  </td>
                </tr>
                {v.expanded === x.id && (
                  <tr>
                    <td colSpan={5}>
                      <dl className={styles.details}>
                        <dt>{t("配置对照 · 源端 / 规划 / 目标")}</dt>
                        <dd>
                          {val.configuration.map((c) => (
                            <div key={c.field}>
                              {t(c.field)}：{c.source} / {c.expected} /{" "}
                              {c.actual}
                            </div>
                          ))}
                        </dd>
                        <dt>{t("虚拟机标识")}</dt>
                        <dd>{x.assetId}</dd>
                        <dt>{t("源端网络")}</dt>
                        <dd>{t(val.sourceValue)}</dd>
                        <dt>{t("规划目标")}</dt>
                        <dd>
                          {x.computeResource} / {val.expectedValue}
                        </dd>
                        <dt>{t("实际目标")}</dt>
                        <dd>{val.actualValue}</dd>
                        <dt>{t("技术差异与处理说明")}</dt>
                        <dd>
                          {t(val.acceptanceNote || val.difference || "无差异")}
                        </dd>
                        <dt>{t("业务确认记录")}</dt>
                        <dd>
                          {t(val.note || "尚未填写")} {t(val.confirmedBy || "")}{" "}
                          {val.confirmedAt?.replace("T", " ").slice(0, 19)}
                        </dd>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        <Pagination
          total={filtered.length}
          value={{ page: v.page, size: v.size }}
          onChange={(x) => onView(x)}
          sizes={[20, 50, 100]}
          label={t("验证结果")}
          compact
          disabled={locked}
        />
        <section className={styles.stack}>
          <h3>{t("问题反馈与附件")}</h3>
          {!e.feedback.length && (
            <p className={styles.muted}>
              {t("暂无反馈，可记录迁移问题或改进建议。")}
            </p>
          )}
          {e.feedback.map((f) => (
            <section key={f.id} className={styles.issue}>
              <Button
                onClick={() =>
                  onView({
                    feedbackId: v.feedbackId === f.id ? "" : f.id,
                    resolution: f.resolution,
                    feedbackRevision: e.revision,
                  })
                }
              >
                <strong>{f.description}</strong>
                <span
                  data-tone={f.status === "resolved" ? "success" : "warning"}
                >
                  {t(
                    f.status === "open"
                      ? "待处理"
                      : f.status === "review"
                        ? "待复查"
                        : "已解决",
                  )}
                </span>
              </Button>
              {(v.feedbackId === f.id || e.feedback.at(-1)?.id === f.id) && (
                <div className={styles.stack}>
                  <p className={styles.muted}>
                    {t("关联 {0} 台虚拟机", f.taskIds.length)} ·{" "}
                    {t(f.blocking ? "影响业务" : "普通建议")}
                  </p>
                  {!e.finalized && (
                    <label className={styles.field}>
                      {t("补充反馈附件")}
                      <input
                        type="file"
                        onChange={(x) => {
                          const file = x.target.files?.[0];
                          if (file) void onUpload(`feedback:${f.id}`, file);
                        }}
                      />
                    </label>
                  )}
                  {f.attachments.map((id, i) => (
                    <Button key={id} onClick={() => onDownload(id)}>
                      {t("下载反馈附件")} {i + 1}
                    </Button>
                  ))}
                  {f.status !== "resolved" && !e.finalized && (
                    <>
                      <label className={styles.field}>
                        {t("处理与复查说明")}
                        <textarea
                          value={
                            v.feedbackId === f.id ? v.resolution : f.resolution
                          }
                          onChange={(x) =>
                            onView({
                              feedbackId: f.id,
                              resolution: x.target.value,
                              feedbackRevision:
                                v.feedbackId === f.id
                                  ? v.feedbackRevision
                                  : e.revision,
                            })
                          }
                        />
                      </label>
                      {v.feedbackId === f.id &&
                        v.feedbackRevision !== undefined &&
                        v.feedbackRevision !== e.revision && (
                          <p className={styles.notice}>
                            {t("验证状态已更新，请核对最新结果后重新提交")}{" "}
                            <Button
                              onClick={() =>
                                onView({ feedbackRevision: e.revision })
                              }
                            >
                              {t("已核对最新状态")}
                            </Button>
                          </p>
                        )}
                      <div className={styles.actions}>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void send({
                              type: "validation.feedbackReview",
                              expectedRevision:
                                v.feedbackId === f.id
                                  ? v.feedbackRevision
                                  : e.revision,
                              feedbackId: f.id,
                              resolution:
                                v.feedbackId === f.id
                                  ? v.resolution
                                  : f.resolution,
                              confirm: f.status === "review",
                            })
                          }
                        >
                          {t(
                            f.status === "review"
                              ? "确认模拟复查通过"
                              : "提交处理说明",
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          ))}
        </section>
        {!e.finalized && (
          <div className={styles.actions}>
            <Button
              disabled={
                locked ||
                !e.tasks.length ||
                rows.length !== e.tasks.length ||
                rows.some(
                  (r) => r.val.business !== "passed" || !canValidate(e, r.val),
                )
              }
              onClick={() => setFinalConfirm(true)}
            >
              {t("确认最终交付")}
            </Button>
          </div>
        )}
        {finalConfirm && (
          <section className={styles.editor}>
            <p>
              {t(
                "全部纳入对象已完成验证。确认后本次迁移只读，并生成最终交付汇总。",
              )}
            </p>
            <div className={styles.actions}>
              <Button onClick={() => setFinalConfirm(false)}>
                {t("取消")}
              </Button>
              <Button
                primary
                disabled={busy}
                onClick={() => void send({ type: "validation.finalize" })}
              >
                {t("确认最终交付")}
              </Button>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
