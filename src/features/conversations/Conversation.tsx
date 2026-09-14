import type { ConversationView } from "@/app/state";
import type {
  Conversation as ConversationModel,
  ProjectSnapshot,
} from "@/domain/models";
import type { FilePurpose } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { EmptyState } from "@/shared/ui/Status";
import { Button } from "@/shared/ui/primitives";
import { useEffect, useRef } from "react";
import { BusinessResults, type ResultActions } from "./BusinessResults";
import styles from "./Conversation.module.css";
import { ConversationAnswer, ThinkingIndicator } from "./ConversationAnswer";
import { StageWork } from "./StageWork";
export function Conversation({
  snapshot: s,
  chat,
  view,
  onUpload,
  onCloseWork,
  ...actions
}: {
  snapshot: ProjectSnapshot;
  chat: ConversationModel;
  view: ConversationView;
  onUpload: (purpose: FilePurpose, file: File) => void;
  onCloseWork: () => void;
} & ResultActions) {
  const t = useTranslation();
  const end = useRef<HTMLDivElement>(null);
  const messages = s.messages.filter((m) => m.conversationId === chat.id);
  const pending = s.pending[chat.id];
  const busy = !!pending;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "instant" });
  }, [chat.id, messages.length, busy]);
  return (
    <div className={styles.root}>
      <div role="log" aria-label={t("迁移对话记录")} aria-live="polite">
        {messages.map((message) => (
          <article
            className={
              message.role === "user"
                ? styles.user
                : message.role === "system"
                  ? styles.system
                  : styles.answer
            }
            key={message.id}
          >
            {message.role === "agent" ? (
              <>
                <ConversationAnswer text={message.text} reply={message.reply} />
                {message.results && (
                  <BusinessResults
                    results={message.results}
                    snapshot={s}
                    {...actions}
                  />
                )}
              </>
            ) : (
              <p>{message.text}</p>
            )}
          </article>
        ))}
      </div>
      {!messages.length && (
        <EmptyState
          title={chat.stageId ? "在当前阶段开启讨论" : "这次想讨论什么？"}
          detail={
            chat.stageId
              ? "已关联当前项目资料与任务。直接提问，或从输入框上方选择操作。"
              : "可以先讨论迁移需求，再创建项目。"
          }
        />
      )}
      {chat.stageId &&
        (view.workOpen ??
          (chat.kind === "main" &&
            (chat.stageId === "research"
              ? s.assessmentStatus !== "completed"
              : chat.stageId === "planning"
                ? s.planningStatus !== "completed"
                : true))) && (
          <div className={styles.work}>
            {chat.kind === "child" && (
              <div className={styles.workHeader}>
                <span>{t("阶段操作 · 项目共享")}</span>
                <Button onClick={onCloseWork}>{t("收起")}</Button>
              </div>
            )}
            <StageWork
              stage={chat.stageId}
              snapshot={s}
              onUpload={onUpload}
              {...actions}
            />
          </div>
        )}
      {pending && (
        <ThinkingIndicator key={chat.id} startedAt={pending.startedAt} />
      )}
      <div ref={end} />
    </div>
  );
}
