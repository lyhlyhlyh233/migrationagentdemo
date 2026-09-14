import type { ExecutionTaskKind, ProjectSnapshot } from "@/domain/models";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button, ResultFrame } from "@/shared/ui/primitives";
import { Status } from "@/shared/ui/Status";
export function MigrationForm({
  snapshot: s,
  onCommand,
  onTasks,
}: {
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => void;
  onTasks: (kind: ExecutionTaskKind) => void;
}) {
  const t = useTranslation();
  return (
    <ResultFrame
      title={t("近端 MD 与实施任务")}
      actions={
        s.mdStatus !== "ready" ? (
          <Button
            primary
            disabled={s.mdStatus !== "unconfigured"}
            onClick={() => onCommand({ type: "md.check" })}
          >
            {t(s.mdStatus === "unconfigured" ? "检查连接与配置" : "正在检查…")}
          </Button>
        ) : undefined
      }
    >
      <p>{t("检查近端连接、源端与目标端资源发现及网络映射。")}</p>
      <Status value={s.mdStatus} />
      {s.mdStatus === "ready" &&
        (["creation", "sync", "cutover"] as const).map((kind) => (
          <p key={kind}>
            <Button onClick={() => onTasks(kind)}>
              {t(
                {
                  creation: "配置新建任务",
                  sync: "查看增量同步",
                  cutover: "查看割接任务",
                }[kind],
              )}
            </Button>{" "}
            <span>
              {s.executionMetrics[kind].completed} /{" "}
              {s.executionMetrics[kind].total}
            </span>
          </p>
        ))}
    </ResultFrame>
  );
}
