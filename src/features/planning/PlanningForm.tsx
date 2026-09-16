import { Icon } from "@/shared/ui/icons";
import type { ProjectSnapshot } from "@/domain/models";
import { planningIsStale } from "@/domain/planning";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import styles from "./Planning.module.css";
export function PlanningForm({
  snapshot: s,
  onCommand,
  onDownload,
  onOpen,
  dirty = false,
  demoTools = false,
}: {
  snapshot: ProjectSnapshot;
  dirty?: boolean;
  demoTools?: boolean;
  onCommand: (cmd: ProjectCommand) => void;
  onDownload: (id: string) => void;
  onOpen: () => void;
}) {
  const t = useTranslation();
  const generated = !!s.planning?.batches.length;
  const stale = planningIsStale(s);
  return (
    <div className={styles.resultActions}>
      <Button onClick={onOpen}>
        {t(generated ? "查看当前规划" : "补充规划资料")}
        <Icon name="right" size={15} />
      </Button>
      <Button onClick={() => onDownload("planning-template")}>
        {t("下载规划模板")}
      </Button>
      {(!generated || stale) && (
        <Button
          primary
          disabled={
            dirty ||
            s.planningStatus === "generating" ||
            s.batchConfirmation === "confirmed" ||
            !!s.planning?.preview
          }
          onClick={() => onCommand({ type: "planning.generate" })}
        >
          {t(
            s.planningStatus === "generating"
              ? "正在生成"
              : stale
                ? demoTools
                  ? "重新生成模拟初稿"
                  : "重新生成规划初稿"
                : "生成规划初稿",
          )}
          <Icon name="right" size={15} />
        </Button>
      )}
    </div>
  );
}
