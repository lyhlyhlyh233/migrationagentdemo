import styles from "./AssessmentForm.module.css";
import { useState } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import type { FilePurpose, ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { Button, FileField, ResultFrame } from "@/shared/ui/primitives";
export function AssessmentForm({
  snapshot: s,
  onCommand,
  onUpload,
  onDownload,
  disabled = false,
}: {
  snapshot: ProjectSnapshot;
  disabled?: boolean;
  onCommand: (cmd: ProjectCommand) => void;
  onUpload: (purpose: FilePurpose, file: File) => void;
  onDownload: (id: string) => void | Promise<unknown>;
}) {
  const t = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const locked =
    disabled || ["running", "completed"].includes(s.assessmentStatus);
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
            disabled={disabled || s.assessmentStatus !== "ready"}
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
      <div className={styles.files}>
        <FileField
          label={t("RVTools 采集表")}
          filename={s.files.rvtools}
          disabled={locked}
          onFile={(file) => onUpload("rvtools", file)}
        />
        <FileField
          label={t("迁移调研表")}
          labelAction={
            <Button
              className={styles.download}
              disabled={downloading}
              aria-label={t("下载迁移调研表模板")}
              aria-busy={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await onDownload("research-template");
                } finally {
                  setDownloading(false);
                }
              }}
            >
              <Icon name="download" size={14} />
              {t(downloading ? "下载中…" : "下载模板")}
            </Button>
          }
          filename={s.files.presales}
          disabled={locked}
          onFile={(file) => onUpload("presales", file)}
        />
      </div>
      <p className={styles.templateHint}>
        {t("模板含填写示例，请按项目实际情况替换后上传。")}
      </p>
    </ResultFrame>
  );
}
