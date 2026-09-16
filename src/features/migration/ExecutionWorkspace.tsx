import type { ProjectSnapshot } from "@/domain/models";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { useTranslation } from "@/shared/i18n";
import { ExecutionDashboard } from "./ExecutionDashboard";
import type { ExecutionView } from "@/stores/executionState";
import styles from "./Execution.module.css";

export type ExecutionRequest =
  | { kind: "connection" }
  | { kind: "issue"; issueId: string }
  | { kind: "tasks"; taskIds: string[] };
export interface ExecutionWorkspaceProps {
  snapshot: ProjectSnapshot;
  demoTools?: boolean;
  view: ExecutionView;
  onView: (value: Partial<ExecutionView>) => void;
  onDownload: (id: string) => void;
  onContext?: (label: string) => void;
  onRequest?: (request: ExecutionRequest) => void;
}
export function ExecutionWorkspace({
  snapshot: s,
  demoTools = false,
  view: v,
  onView,
  onDownload,
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
      className={styles.root}
      data-compact
      aria-label={t("迁移实施工作区")}
    >
      <div className={styles.body}>
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
              demoTools={demoTools}
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
