import { useEffect, useRef } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { RiskWorkspace } from "./RiskWorkspace";
import type { RiskLocation } from "./presentation";
import styles from "./RiskSidePanel.module.css";
export function RiskSidePanel({
  snapshot,
  onCommand,
  onClose,
  onManage,
  location,
  onLocationChange,
}: {
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onClose: () => void;
  onManage: (location: RiskLocation) => void;
  location: RiskLocation;
  onLocationChange: (location: RiskLocation) => void;
}) {
  const t = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const origin = document.activeElement;
    heading.current?.focus({ preventScroll: true });
    return () => {
      if (origin instanceof HTMLElement && origin.isConnected)
        origin.focus({ preventScroll: true });
    };
  }, []);
  return (
    <aside className={styles.root} aria-label={t("迁移风险与策略")}>
      <header>
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {t("迁移风险与策略")}
          </h2>
          <span>{snapshot.info?.siteName}</span>
        </div>
        <button
          type="button"
          onClick={() =>
            onManage({ mode: "category", category: location.category })
          }
        >
          {t("打开迁移风险页面")}
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={t("关闭风险面板")}
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </button>
      </header>
      <div className={styles.body}>
        <RiskWorkspace
          key={snapshot.id}
          snapshot={snapshot}
          onCommand={onCommand}
          sidePanel
          location={location}
          onLocationChange={onLocationChange}
          onManage={onManage}
        />
      </div>
    </aside>
  );
}
