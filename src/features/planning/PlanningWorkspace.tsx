import type { ProjectSnapshot } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { PlanningSummary } from "./PlanningSummary";
import styles from "./Planning.module.css";

export interface PlanningWorkspaceProps {
  snapshot: ProjectSnapshot;
  demoTools?: boolean;
  onDownload: (id: string) => void;
  onConversation?: () => void;
}

export function PlanningWorkspace({
  snapshot: s,
  onDownload,
  onConversation,
  demoTools = false,
}: PlanningWorkspaceProps) {
  const t = useTranslation();
  const p = s.planning;
  if (!p?.batches.length || !s.enteredStages.includes("planning"))
    return (
      <section className={`${styles.root} ${styles.empty}`}>
        <h2>{t("迁移规划")}</h2>
        <p>{t("尚未生成规划，请在规划会话中补充资料并生成初稿。")}</p>
        {onConversation && (
          <Button onClick={onConversation}>
            {t("进入规划会话")}
            <Icon name="right" size={15} />
          </Button>
        )}
      </section>
    );

  return (
    <PlanningSummary
      snapshot={s}
      onDownload={onDownload}
      demoTools={demoTools}
    />
  );
}
