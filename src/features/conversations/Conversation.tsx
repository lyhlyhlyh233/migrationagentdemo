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
import {
  ConversationAnswer,
  CopyAnswer,
  ThinkingIndicator,
} from "./ConversationAnswer";
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
  const log = useRef<HTMLDivElement>(null);
  const messages = s.messages.filter((m) => m.conversationId === chat.id);
  const preparation = messages.filter(
    (m) => m.activity === "assessment-preparation",
  );
  const collapsePreparation =
    s.assessmentStatus === "completed" && preparation.length > 0;
  const displayed = collapsePreparation
    ? messages.filter((m) => !m.activity)
    : messages;
  const preparationRecord = collapsePreparation ? (
    <details className={styles.preparation}>
      <summary>{t("资料准备记录")}</summary>
      {preparation.map((m) => (
        <p key={m.id}>
          {m.role === "user" ? t("你") : t("助手")}：{m.text}
        </p>
      ))}
    </details>
  ) : null;
  const historyIndex = displayed[0]?.role === "user" ? 1 : 0;
  const copyId = displayed.findLast(
    (m) =>
      m.role === "agent" &&
      ((m.requestId && !m.operation) ||
        m.results?.some((r) =>
          ["summary", "tasks", "artifacts"].includes(r.kind),
        )),
  )?.id;
  const latestInputId = messages.findLast((m) =>
    m.results?.some((r) => r.kind === "assessment-input"),
  )?.id;
  const pending = s.pending[chat.id];
  const busy = !!pending;
  const lastRole = messages.at(-1)?.role;
  useEffect(() => {
    if (!busy && lastRole === "agent") {
      log.current?.lastElementChild?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    } else end.current?.scrollIntoView({ block: "end", behavior: "instant" });
  }, [chat.id, messages.length, busy, lastRole]);
  return (
    <div className={styles.root}>
      <div
        ref={log}
        role="log"
        aria-label={t("迁移对话记录")}
        aria-live="polite"
      >
        {displayed.map((message, index) => (
          <div key={message.id}>
            {index === historyIndex && preparationRecord}

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
                  <ConversationAnswer
                    text={message.text}
                    reply={
                      message.reply?.durationMs ? message.reply : undefined
                    }
                  >
                    {message.results && (
                      <BusinessResults
                        results={message.results}
                        snapshot={s}
                        onUpload={onUpload}
                        activeInput={message.id === latestInputId}
                        {...actions}
                      />
                    )}
                    {message.id === copyId && (
                      <CopyAnswer text={message.text} />
                    )}
                  </ConversationAnswer>
                </>
              ) : (
                <p>{message.text}</p>
              )}
            </article>
          </div>
        ))}
        {displayed.length <= historyIndex && preparationRecord}
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
        chat.stageId !== "research" &&
        (view.workOpen ??
          (chat.kind === "main" &&
            (chat.stageId === "planning"
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
