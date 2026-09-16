import type { ProjectSnapshot } from "@/domain/models";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { useTranslation } from "@/shared/i18n";
import { ExecutionDashboard } from "./ExecutionDashboard";
import type { ExecutionView } from "./state";
import styles from "./Execution.module.css";
import workspace from "./ExecutionWorkspace.module.css";

export type ExecutionRequest =
  | { kind: "connection" }
  | { kind: "issue"; issueId: string }
  | { kind: "tasks"; taskIds: string[] };
export interface ExecutionWorkspaceProps {
  snapshot: ProjectSnapshot;
  view: ExecutionView;
  onView: (value: Partial<ExecutionView>) => void;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
  onDownload: (id: string) => void;
  onUpload: (purpose: FilePurpose, file: File) => Promise<boolean>;
  conversationId: string | null;
  compact?: boolean;
  onManage?: () => void;
  onContext?: (label: string) => void;
  onRequest?: (request: ExecutionRequest) => void;
}
export function ExecutionWorkspace({
  snapshot: s,
  view: v,
  onView,
  onDownload,
  compact = false,
  onContext,
  onRequest,
}: ExecutionWorkspaceProps) {
  const t = useTranslation(),
    e = s.execution;
  const selectBatch = (id: string) => {
    onView({
      batchId: id,
      dashboardPage: 1,
      selected: [],
      expandedTask: undefined,
    });
    onContext?.(`${t("批次")} ${id}`);
  };
  return (
    <section
      className={`${styles.root} ${workspace.root}`}
      data-compact={compact || undefined}
      aria-label={t(compact ? "迁移实施工作区" : "迁移任务工作区")}
    >
      {!compact && (
        <header className={`${styles.header} ${workspace.header}`}>
          <h2>{t("迁移任务")}</h2>
          <span className={styles.muted}>
            {t("操作与确认在右侧对话中完成")}
          </span>
        </header>
      )}
      <div className={`${styles.body} ${workspace.body}`}>
        {!e ? (
          <div className={styles.empty}>
            {t("规划确认交接后，可以配置 Migration 连接并启动批次。")}
          </div>
        ) : (
          <>
            {e.connectionStatus !== "ready" && (
              <p className={styles.notice}>
                {t("连接不可用，请在对话中检测 Migration 连接。")}
                <Button onClick={() => onRequest?.({ kind: "connection" })}>
                  {t("配置连接")}
                  <Icon name="right" size={14} />
                </Button>
              </p>
            )}
            <ExecutionDashboard
              execution={e}
              selectedBatchId={v.batchId}
              expandedTaskId={v.expandedTask}
              onBatch={selectBatch}
              taskPage={v.dashboardPage}
              taskSize={v.dashboardSize}
              onPage={({ page, size }) =>
                onView({ dashboardPage: page, dashboardSize: size })
              }
              onTask={(id) => {
                const task = e.tasks.find((item) => item.id === id);
                if (!task) return;
                const expanded = v.expandedTask !== id;
                onContext?.(
                  expanded
                    ? `${task.batchId} · ${task.name}`
                    : `${t("批次")} ${task.batchId}`,
                );
                onView({
                  selected: expanded ? [task.id] : [],
                  expandedTask: expanded ? task.id : undefined,
                });
              }}
              onIssue={(issueId) => onRequest?.({ kind: "issue", issueId })}
              onDownload={onDownload}
            />
          </>
        )}
      </div>
    </section>
  );
}
