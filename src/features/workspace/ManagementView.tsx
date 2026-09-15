import type { PanelId } from "@/app/state";
import type { ProjectSnapshot } from "@/domain/models";
import { completedBatches } from "@/domain/policies";
import { Deliverables } from "@/features/deliverables/Deliverables";
import { OperationLog } from "@/features/logs/OperationLog";
import { CreationTaskPanel } from "@/features/migration/CreationTaskPanel";
import { CutoverTaskPanel } from "@/features/migration/CutoverTaskPanel";
import { SyncTaskPanel } from "@/features/migration/SyncTaskPanel";
import { RiskPanel } from "@/features/risks/RiskPanel";
import type { RiskLocation } from "@/features/risks/presentation";
import { TaskPanel } from "@/features/tasks/TaskPanel";
import { ValidationPanel } from "@/features/validation/ValidationPanel";
import type { ProjectCommand } from "@/services/contracts";
import styles from "./ManagementView.module.css";
export function ManagementView({
  panel,
  snapshot: s,
  onCommand,
  onClose,
  onNotify,
  onDownload,
  riskLocation,
  onRiskLocation,
}: {
  panel: PanelId;
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onClose: () => void;
  onNotify: (s: string) => void;
  onDownload: (id: string) => void;
  riskLocation: RiskLocation;
  onRiskLocation: (location: RiskLocation) => void;
}) {
  const completed = completedBatches(s);
  return (
    <section
      className={`${styles.root} management-surface`}
      data-risk-view={panel === "risk" || undefined}
    >
      {panel === "deliverables" ? (
        <Deliverables artifacts={s.artifacts} onDownload={onDownload} />
      ) : panel === "logs" ? (
        <OperationLog snapshot={s} />
      ) : panel === "risk" ? (
        <RiskPanel
          snapshot={s}
          onCommand={onCommand}
          location={riskLocation}
          onLocationChange={onRiskLocation}
        />
      ) : panel === "tasks" ? (
        <TaskPanel
          projectId={s.id}
          batches={s.batchTasks}
          vmTaskData={s.vmTasks}
          creationTasks={s.creationTasks}
          risks={s.risks}
          completedBatchIds={completed}
          projectExists={!!s.info}
          onClose={onClose}
          onNotify={onNotify}
          onAction={(action, taskIds) => {
            const actions: Record<
              string,
              "sync" | "pause" | "delete" | "schedule" | "cancel-schedule"
            > = {
              同步: "sync",
              paused: "pause",
              删除: "delete",
              定时同步: "schedule",
              取消定时同步: "cancel-schedule",
            };
            if (action === "日志下载") {
              onDownload(`task-log:${taskIds.join(",")}`);
              return;
            }
            const key = actions[action];
            if (key) onCommand({ type: "tasks.action", action: key, taskIds });
          }}
        />
      ) : panel === "creation" ? (
        <CreationTaskPanel
          tasks={s.creationTasks}
          locked={s.executionApprovals.creation}
          onChange={(tasks) => onCommand({ type: "creation.update", tasks })}
          onCreate={() =>
            onCommand({
              type: "creation.update",
              tasks: s.creationTasks,
              create: true,
            })
          }
          onClose={onClose}
          onNotify={onNotify}
        />
      ) : panel === "sync" ? (
        <SyncTaskPanel
          batches={s.batchTasks}
          total={s.executionMetrics.sync.total}
          completed={s.executionMetrics.sync.completed}
          onClose={onClose}
        />
      ) : panel === "cutover" ? (
        <CutoverTaskPanel
          tasks={s.vmTasks.filter(
            (v) =>
              s.batchTasks.find((b) => b.id === v.batchId)?.stageType ===
              "cutover",
          )}
          completedIds={s.validationTasks.map((v) => v.sourceTaskId)}
          running={s.operations["execute-cutover"] === "running"}
          onComplete={(taskIds) =>
            onCommand({ type: "cutover.complete", taskIds })
          }
          onClose={onClose}
          onNotify={onNotify}
        />
      ) : panel === "validation" ? (
        <ValidationPanel
          tasks={s.validationTasks}
          completedBatchIds={completed}
          onConfirm={(id) =>
            onCommand({ type: "validation.confirm", taskIds: [id] })
          }
          onConfirmBatch={(taskIds) =>
            onCommand({ type: "validation.confirm", taskIds })
          }
          onClose={onClose}
        />
      ) : null}
    </section>
  );
}
