import type { ProjectSnapshot } from "@/domain/models";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import type { ExecutionView } from "./state";
import { Button } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/Select";
import { useTranslation } from "@/shared/i18n";
import styles from "./Execution.module.css";
const labels: Record<string, string> = {
  collecting: "正在获取日志",
  diagnosing: "正在诊断",
  ready: "待选择方案",
  "log-failed": "日志获取失败",
  inconclusive: "诊断无结论",
  manual: "等待人工处理",
  repairing: "修复与复查中",
  "repair-failed": "修复或复查失败",
  resolved: "已解决",
};
export function ExecutionIssues({
  snapshot: s,
  view: v,
  onView,
  busy,
  onCommand,
  onUpload,
  onDownload,
}: {
  snapshot: ProjectSnapshot;
  view: ExecutionView;
  onView: (v: Partial<ExecutionView>) => void;
  busy: boolean;
  onCommand: (c: ProjectCommand) => Promise<boolean>;
  onUpload: (p: FilePurpose, f: File) => Promise<boolean>;
  onDownload: (id: string) => void;
}) {
  const t = useTranslation();
  const issues = s.execution?.issues ?? [];
  return (
    <div className={styles.stack}>
      {!issues.length && (
        <p className={styles.empty}>
          {t("当前没有执行异常。任务报错后将自动获取模拟日志并诊断。")}
        </p>
      )}
      {issues.map((i) => (
        <section className={styles.issue} key={i.id}>
          <Button
            onClick={() =>
              onView({
                issueId: v.issueId === i.id ? "" : i.id,
                note: i.note,
                solution:
                  i.solution ??
                  (i.category === "network" ? "automatic" : "manual"),
              })
            }
          >
            <strong>{t(i.title)}</strong>
            <span data-tone={i.state === "resolved" ? "success" : "warning"}>
              {t(labels[i.state])}
            </span>
          </Button>
          {(v.issueId === i.id || (!v.issueId && issues.length === 1)) && (
            <div className={styles.stack}>
              <p>
                {s
                  .execution!.tasks.filter((x) => i.taskIds.includes(x.id))
                  .map((x) => `${x.batchId} / ${x.name}`)
                  .join("、")}
              </p>
              <p>{t(i.diagnosis || "正在核对模拟日志，请稍候。")}</p>
              <details>
                <summary>{t("诊断依据与日志")}</summary>
                <p>{t(i.evidence)}</p>
                {i.logId && (
                  <Button onClick={() => onDownload(i.logId!)}>
                    {t("下载模拟日志")}
                  </Button>
                )}
              </details>
              {!["collecting", "diagnosing", "repairing", "resolved"].includes(
                i.state,
              ) && (
                <>
                  <details>
                    <summary>{t("诊断演示场景")}</summary>
                    <Select
                      value={v.diagnosticFailure}
                      onValueChange={(x) =>
                        onView({
                          diagnosticFailure:
                            x as ExecutionView["diagnosticFailure"],
                        })
                      }
                    >
                      <option value="">{t("正常诊断")}</option>
                      <option value="log-failed">{t("日志获取失败")}</option>
                      <option value="inconclusive">{t("诊断无结论")}</option>
                    </Select>
                  </details>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void onCommand({
                        type: "execution.diagnose",
                        issueId: i.id,
                        simulate: v.diagnosticFailure || undefined,
                      })
                    }
                  >
                    {t("重新获取日志并诊断")}
                  </Button>
                  {!["log-failed", "inconclusive"].includes(i.state) && (
                    <>
                      <div className={styles.options}>
                        <label
                          title={t(
                            i.category !== "network"
                              ? "该问题需要人工处理"
                              : "重建同步通道，保留已同步数据",
                          )}
                        >
                          <input
                            type="radio"
                            name={`solution-${i.id}`}
                            checked={v.solution === "automatic"}
                            disabled={i.category !== "network"}
                            onChange={() => onView({ solution: "automatic" })}
                          />
                          {t("自动重建同步通道")}
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`solution-${i.id}`}
                            checked={v.solution === "manual"}
                            onChange={() => onView({ solution: "manual" })}
                          />
                          {t("人工处理后复查")}
                        </label>
                      </div>
                      <label className={styles.field}>
                        {t("处理说明")}
                        <textarea
                          value={v.note}
                          onChange={(e) => onView({ note: e.target.value })}
                          placeholder={t("记录处理措施与复查依据")}
                        />
                      </label>
                      <label className={styles.field}>
                        {t("补充证据附件")}
                        <input
                          type="file"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void onUpload(`issue:${i.id}`, f);
                          }}
                        />
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={v.simulateFailure}
                          onChange={(e) =>
                            onView({ simulateFailure: e.target.checked })
                          }
                        />{" "}
                        {t("模拟修复或复查失败")}
                      </label>
                      <div className={styles.actions}>
                        {i.solution && (
                          <Button
                            disabled={busy || v.note.trim().length < 4}
                            onClick={() =>
                              void onCommand({
                                type: "execution.recheck",
                                issueId: i.id,
                                note: v.note,
                                simulateFailure: v.simulateFailure,
                              })
                            }
                          >
                            {t("提交处理并复查")}
                          </Button>
                        )}
                        <Button
                          primary
                          disabled={
                            busy ||
                            (v.solution === "automatic" &&
                              i.category !== "network")
                          }
                          onClick={() =>
                            void onCommand({
                              type: "execution.remedy",
                              issueId: i.id,
                              solution: v.solution,
                              note: v.note,
                              simulateFailure: v.simulateFailure,
                            })
                          }
                        >
                          {t(
                            v.solution === "automatic"
                              ? "确认诊断并执行方案"
                              : "确认采用人工方案",
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
              {i.attachments.map((id, index) => (
                <Button key={id} onClick={() => onDownload(id)}>
                  {t("下载证据附件")} {index + 1}
                </Button>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
