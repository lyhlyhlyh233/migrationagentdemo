import type { ProjectSnapshot } from "@/domain/models";
import type { FilePurpose, ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button, FileField, ResultFrame } from "@/shared/ui/primitives";
export function AssessmentForm({
  snapshot: s,
  onCommand,
  onUpload,
}: {
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => void;
  onUpload: (purpose: FilePurpose, file: File) => void;
}) {
  const t = useTranslation();
  const locked = ["running", "completed"].includes(s.assessmentStatus);
  return (
    <ResultFrame
      title={t("评估资料")}
      actions={
        <>
          <Button
            disabled={locked}
            onClick={() => onCommand({ type: "assessment.useSamples" })}
          >
            {t("使用示例资料")}
          </Button>
          <Button
            primary
            disabled={s.assessmentStatus !== "ready"}
            onClick={() => onCommand({ type: "assessment.start" })}
          >
            {t(
              s.assessmentStatus === "running"
                ? "正在评估…"
                : s.assessmentStatus === "completed"
                  ? "评估已完成"
                  : "开始评估",
            )}
          </Button>
        </>
      }
    >
      <FileField
        label={t("RVTools 采集表")}
        filename={s.files.rvtools}
        disabled={locked}
        onFile={(file) => onUpload("rvtools", file)}
      />
      <FileField
        label={t("售前调用表")}
        filename={s.files.presales}
        disabled={locked}
        onFile={(file) => onUpload("presales", file)}
      />
    </ResultFrame>
  );
}
