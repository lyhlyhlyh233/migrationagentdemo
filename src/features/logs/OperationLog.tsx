import type { ProjectSnapshot } from "@/domain/models";
import { stageTitles } from "@/shared/i18n/stages";

import { useTranslation } from "@/shared/i18n";
import { EmptyState } from "@/shared/ui/Status";
export function OperationLog({ snapshot: s }: { snapshot: ProjectSnapshot }) {
  const t = useTranslation();
  const messages = s.messages.filter((m) => m.operation);
  return (
    <section className="project-records">
      <h2>{t("操作日志")}</h2>
      <p>{t("当前项目的执行事件与人工操作记录。")}</p>
      {messages.length ? (
        <ol className="operation-log">
          {messages.map((m) => (
            <li key={m.id}>
              <time>{m.time}</time>
              <div>
                <small>
                  {t(m.stageId ? stageTitles[m.stageId] : "临时会话")} ·{" "}
                  {t(
                    s.conversations.find((c) => c.id === m.conversationId)
                      ?.title ?? "项目会话",
                  )}
                </small>
                <p>{m.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="暂无操作记录" />
      )}
    </section>
  );
}
