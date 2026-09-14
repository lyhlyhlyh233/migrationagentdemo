import { migrationScope } from "@/domain/assessment";
import type { ProjectSnapshot } from "@/domain/models";
import type { FilePurpose, ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button, FileField, ResultFrame } from "@/shared/ui/primitives";
export function PlanningForm({
  snapshot: s,
  onCommand,
  onUpload,
  onDownload,
  onTasks,
}: {
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => void;
  onUpload: (purpose: FilePurpose, file: File) => void;
  onDownload: (id: string) => void;
  onTasks: () => void;
}) {
  const t = useTranslation();
  const scope = s.planningStatus === "scope-review";
  const artifact = s.artifacts.find(
    (a) => a.id === (scope ? "scope" : "planning-template"),
  );
  return (
    <ResultFrame
      title={t(scope ? "确认迁移范围" : "业务信息与迁移约束")}
      actions={
        s.planningStatus === "completed" ? (
          <>
            <Button onClick={onTasks}>{t("查看迁移批次")}</Button>
            <Button
              onClick={() => onCommand({ type: "planning.requestAdjustment" })}
              disabled={s.batchConfirmation === "confirmed"}
            >
              {t("调整迁移批次")}
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={!artifact}
              onClick={() => artifact && onDownload(artifact.id)}
            >
              {t(scope ? "下载范围列表" : "下载规划模板")}
            </Button>
            <Button
              primary
              disabled={s.planningStatus === "generating"}
              onClick={() =>
                onCommand({
                  type: scope ? "planning.confirmScope" : "planning.useSample",
                })
              }
            >
              {t(scope ? "确认迁移范围" : "使用示例规划信息")}
            </Button>
          </>
        )
      }
    >
      <p>
        {t("迁移范围")} · <strong>{migrationScope(s).length}</strong>{" "}
        {t("台虚拟机")}
      </p>
      <p>{t("受阻、未完成整改及本次不迁的对象已自动排除，风险记录仍保留。")}</p>
      {s.planningStatus === "completed" ? (
        <p>{t("批次计划与 RunBook 已生成。请核对风险后人工确认交接。")}</p>
      ) : (
        <>
          <p>
            {t(
              scope
                ? "核对资产清单；如有调整，可上传修改后的文件。"
                : "请填写业务分级、依赖关系、迁移窗口和回退要求。",
            )}
          </p>
          <FileField
            label={t(scope ? "上传调整后的范围" : "上传规划信息")}
            filename={scope ? s.scopeRevisionFile : s.planningWorkbook}
            disabled={s.planningStatus === "generating"}
            onFile={(file) => onUpload(scope ? "scope" : "planning", file)}
          />
        </>
      )}
    </ResultFrame>
  );
}
