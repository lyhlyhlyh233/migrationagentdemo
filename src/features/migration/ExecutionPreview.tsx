import type { ExecutionPreview as Preview } from "@/domain/execution";
import type { ProjectCommand } from "@/services/contracts";
import { actionLabels } from "@/domain/execution";
import { Button } from "@/shared/ui/primitives";
import { useTranslation } from "@/shared/i18n";
import styles from "./Execution.module.css";
export function ExecutionPreview({
  preview,
  conversationId,
  busy,
  onCommand,
}: {
  preview: Preview;
  conversationId: string | null;
  busy: boolean;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
}) {
  const t = useTranslation(),
    own = preview.origin.conversationId === conversationId;
  return (
    <section className={styles.editor} aria-label={t("操作预览")}>
      <h3>
        {t(actionLabels[preview.action])} · {t("确认范围")}
      </h3>
      {preview.rows.map((r, i) => (
        <p key={i}>
          <strong>{t(r.label)}</strong>：{t(r.before)} → {t(r.after)}
        </p>
      ))}
      {preview.action === "cutover" && (
        <p className={styles.notice}>
          {t(
            "确认后模拟停止同步并执行割接。异常对象不可提交；完成后仍需人工业务验证。",
          )}
        </p>
      )}
      {!own && <p>{t("此预览来自其他会话，请返回发起会话处理。")}</p>}
      <div className={styles.actions}>
        <Button
          disabled={busy || !own}
          onClick={() =>
            void onCommand({ type: "execution.cancel", previewId: preview.id })
          }
        >
          {t("取消")}
        </Button>
        <Button
          primary
          disabled={busy || !own}
          onClick={() =>
            void onCommand({ type: "execution.apply", previewId: preview.id })
          }
        >
          {t(busy ? "正在应用" : "确认应用")}
        </Button>
      </div>
    </section>
  );
}
