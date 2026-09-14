import { useTranslation } from "@/shared/i18n/index";
import { Icon } from "@/shared/ui/icons";
import { useEffect, useState } from "react";
import styles from "./ConversationAnswer.module.css";

import type { ReplyPresentation } from "@/domain/models";

function InlineText({ text }: { text: string }) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

function AnswerBody({ text }: { text: string }) {
  return (
    <div className="message-body reply-result">
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((block, index) => {
          const lines = block.split("\n");
          if (lines.every((line) => /^-\s+/.test(line)))
            return (
              <ul key={index}>
                {lines.map((line, item) => (
                  <li key={item}>
                    <InlineText text={line.replace(/^-\s+/, "")} />
                  </li>
                ))}
              </ul>
            );
          if (lines.every((line) => /^\d+\.\s+/.test(line)))
            return (
              <ol key={index}>
                {lines.map((line, item) => (
                  <li key={item}>
                    <InlineText text={line.replace(/^\d+\.\s+/, "")} />
                  </li>
                ))}
              </ol>
            );
          return (
            <p key={index}>
              <InlineText text={block} />
            </p>
          );
        })}
    </div>
  );
}

export function ConversationAnswer({
  text,
  reply,
  children,
}: {
  text: string;
  reply?: ReplyPresentation;
  children?: React.ReactNode;
}) {
  const t = useTranslation();
  return (
    <div className={`${styles.root} conversation-answer`}>
      {reply ? (
        <details className="reply-thought">
          <summary>
            <Icon name="agent" size={14} />
            <span>{t("思考摘要")}</span>
            <span className="reply-duration">
              {t("耗时 {0} 秒", Math.floor(reply.durationMs / 1000))}
            </span>
            <Icon name="chevron" size={12} />
          </summary>
          <p>{reply.summary}</p>
        </details>
      ) : null}
      <div aria-label={t("最终结果")}>
        <AnswerBody text={text} />
      </div>
      {children}
    </div>
  );
}

export function CopyAnswer({ text }: { text: string }) {
  const t = useTranslation();
  const [copyStatus, setCopyStatus] = useState("");
  return (
    <div className={styles.actions}>
      <button
        type="button"
        aria-label={t("复制回答正文")}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopyStatus("已复制");
          } catch {
            setCopyStatus("复制失败，请选择正文复制");
          }
        }}
      >
        <Icon name="copy" size={14} />
        <span>{t(copyStatus || "复制")}</span>
      </button>
    </div>
  );
}

export function ThinkingIndicator({ startedAt }: { startedAt: number }) {
  const t = useTranslation();
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Date.now() - startedAt),
  );
  useEffect(() => {
    const timer = window.setInterval(
      () => setElapsed(Math.max(0, Date.now() - startedAt)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return (
    <div className={styles.root}>
      <div className="thinking-status" role="status">
        <span className="thinking-dot" />
        <span>{t("思考中…")}</span>
        <span className="reply-duration" aria-hidden="true">
          {t("耗时 {0} 秒", Math.floor(elapsed / 1000))}
        </span>
      </div>
    </div>
  );
}
