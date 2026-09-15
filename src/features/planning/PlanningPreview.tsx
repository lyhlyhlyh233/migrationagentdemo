import { planningConditionFields } from "@/shared/i18n/planning";
import { useState, useEffect, useRef } from "react";
import type { PlanningPreview as Preview } from "@/domain/planning";

import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import styles from "./Planning.module.css";
export function PlanningPreview({
  preview,
  onCommand,
  canApply = true,
}: {
  preview: Preview;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
  canApply?: boolean;
}) {
  const t = useTranslation();
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = region.current;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const workspace = element?.parentElement?.closest("section");
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: "nearest", behavior: "instant" });
    return () => {
      requestAnimationFrame(() => {
        if (element?.isConnected) return;
        if (trigger?.isConnected && !trigger.matches(":disabled"))
          trigger.focus({ preventScroll: true });
        else if (workspace?.isConnected)
          workspace.focus({ preventScroll: true });
      });
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  async function submit(type: "planning.apply" | "planning.cancel") {
    setBusy(true);
    setError(false);
    const success = await onCommand({ type, previewId: preview.id });
    setBusy(false);
    setError(!success);
  }
  return (
    <section
      ref={region}
      tabIndex={-1}
      className={styles.preview}
      aria-label={t("规划调整预览")}
    >
      <header>
        <strong>
          {t(preview.change.kind === "import" ? "示例解析预览" : "调整预览")}
        </strong>
        <span>{t("共 {0} 项", preview.rows.length)}</span>
      </header>
      <p>
        {t(
          preview.change.kind === "import"
            ? "展示示例解析结果，尚未读取实际表格内容。已有填写会保留。"
            : "确认后才应用。示例时间未经真实排程求解，请核对依赖影响。",
        )}
      </p>
      <div className={styles.previewRows}>
        <div>
          <b>{t("修改项")}</b>
          <b>{t("修改前")}</b>
          <b>{t("修改后")}</b>
        </div>
        {(expanded ? preview.rows.slice(0, 100) : preview.rows.slice(0, 3)).map(
          (row, i) => (
            <div key={i}>
              <span>
                {t(
                  planningConditionFields.find(
                    ([key]) => key === row.label,
                  )?.[1] ?? row.label,
                )}
              </span>
              <span>{t(row.before)}</span>
              <strong>{t(row.after)}</strong>
            </div>
          ),
        )}
      </div>
      {preview.rows.length > 3 && (
        <Button onClick={() => setExpanded(!expanded)}>
          {t(
            expanded ? "收起" : "展开其余 {0} 项",
            Math.min(preview.rows.length, 100) - 3,
          )}
        </Button>
      )}
      {expanded && preview.rows.length > 100 && (
        <small>{t("预览显示前 100 项，应用范围包含全部所选对象。")}</small>
      )}
      {error && (
        <p role="alert" data-tone="danger">
          {t("操作未完成，输入已保留。请核对最新数据后重试，或取消预览。")}
        </p>
      )}
      {!canApply && <p>{t("请在发起调整的会话中应用或取消")}</p>}
      <footer>
        <Button
          disabled={busy || !canApply}
          onClick={() => void submit("planning.cancel")}
        >
          {t("取消")}
        </Button>
        <Button
          primary
          disabled={busy || !canApply}
          onClick={() => void submit("planning.apply")}
        >
          {t(busy ? "正在保存" : "应用调整")}
        </Button>
      </footer>
    </section>
  );
}
