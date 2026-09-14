import { useTranslation } from "@/shared/i18n";
import { RiskWorkspace, type RiskWorkspaceProps } from "./RiskWorkspace";
import styles from "./RiskPanel.module.css";

export function RiskPanel(props: RiskWorkspaceProps) {
  const t = useTranslation();
  return (
    <section className={styles.root} aria-label={t("迁移风险与策略")}>
      <header className={styles.heading}>
        <h2>{t("迁移风险与策略")}</h2>
      </header>
      <RiskWorkspace key={props.snapshot.id} {...props} />
    </section>
  );
}
