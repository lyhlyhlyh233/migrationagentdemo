import type { PanelId } from "@/app/state";
import type { ProjectSnapshot, StageId } from "@/domain/models";
import { MigrationForm } from "@/features/migration/MigrationForm";
import { PlanningForm } from "@/features/planning/PlanningForm";
import { AssessmentForm } from "@/features/research/AssessmentForm";
import type { FilePurpose, ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button, ResultFrame } from "@/shared/ui/primitives";
export function StageWork({
  stage,
  snapshot,
  onCommand,
  onUpload,
  onDownload,
  onPanel,
}: {
  stage: StageId;
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => void;
  onUpload: (purpose: FilePurpose, file: File) => void;
  onDownload: (id: string) => void;
  onPanel: (panel: PanelId) => void;
}) {
  const t = useTranslation();
  return (
    <div className="workflow-embeds">
      {stage === "research" ? (
        <AssessmentForm
          snapshot={snapshot}
          onCommand={onCommand}
          onUpload={onUpload}
          onDownload={onDownload}
        />
      ) : stage === "planning" ? (
        <PlanningForm
          snapshot={snapshot}
          onCommand={onCommand}
          onDownload={onDownload}
          onOpen={() => onPanel("planning")}
        />
      ) : stage === "migration" ? (
        <MigrationForm
          snapshot={snapshot}
          onCommand={onCommand}
          onTasks={onPanel}
        />
      ) : (
        <ResultFrame
          title={t("结果验证")}
          actions={
            <Button onClick={() => onPanel("validation")}>
              {t("查看验证结果")}
            </Button>
          }
        >
          <p>{t("请核对源端与目标端配置，逐台或批量完成人工验收。")}</p>
        </ResultFrame>
      )}
    </div>
  );
}
