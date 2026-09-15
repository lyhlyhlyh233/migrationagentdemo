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
  onCommand: (cmd: ProjectCommand) => void | Promise<boolean>;
  onUpload: (purpose: FilePurpose, file: File) => void | Promise<boolean>;
  onDownload: (id: string) => void | Promise<unknown>;
}) {
  const t = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const [pending, setPending] = useState<
    { kind: "sample" } | { kind: "file"; purpose: FilePurpose; file: File }
  >();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const locked =
    saving ||
    !!pending ||
    disabled ||
    ["running", "completed"].includes(s.assessmentStatus);
  return (
    <ResultFrame
      title={t("评估资料")}
      actions={
        <>
          <Button
            disabled={locked}
            onClick={() => {
              setError(false);
              setPending({ kind: "sample" });
            }}
          >
            {t("使用样例数据")}
          </Button>
          <Button
            primary
            disabled={locked || s.assessmentStatus !== "ready"}
            onClick={() => onCommand({ type: "assessment.start" })}
          >
            {t(
              s.assessmentStatus === "running"
                ? "正在评估…"
                : s.assessmentStatus === "completed"
                  ? "评估已完成"
                  : "开始评估",
            )}
            <Icon name="right" size={15} />
          </Button>
        </>
      }
    >
      <div className={styles.files}>
        <FileField
          label={t("RVTools 采集表")}
          filename={s.files.rvtools}
          disabled={locked}
          onFile={(file) => {
            setError(false);
            setPending({ kind: "file", purpose: "rvtools", file });
          }}
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
          onFile={(file) => {
            setError(false);
            setPending({ kind: "file", purpose: "presales", file });
          }}
        />
      </div>
      {pending && (
        <section className={styles.preview} aria-label={t("评估资料接收预览")}>
          <strong>
            {pending.kind === "sample"
              ? t("RVTools 采集表与迁移调研表 · 样例数据")
              : pending.file.name}
          </strong>
          <p>
            {t("确认后用于后续评估，将替换对应的已选资料；尚未解析实际内容。")}
          </p>
          {error && (
            <p role="alert">{t("接收失败，所选资料已保留，请重试。")}</p>
          )}
          <div>
            <Button disabled={saving} onClick={() => setPending(undefined)}>
              {t("取消")}
            </Button>
            <Button
              primary
              disabled={saving || disabled}
              onClick={async () => {
                setSaving(true);
                setError(false);
                try {
                  const ok =
                    pending.kind === "sample"
                      ? await onCommand({ type: "assessment.useSamples" })
                      : await onUpload(pending.purpose, pending.file);
                  if (ok === false) setError(true);
                  else setPending(undefined);
                } catch {
                  setError(true);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {t(saving ? "接收中…" : "确认使用资料")}
              <Icon name="right" size={15} />
            </Button>
          </div>
        </section>
      )}
      <p className={styles.templateHint}>
        {t("模板含填写示例，请按项目实际情况替换后上传。")}
      </p>
    </ResultFrame>
  );
}
