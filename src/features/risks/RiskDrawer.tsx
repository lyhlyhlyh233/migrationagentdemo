import { useEffect, useRef } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { RiskWorkspace } from "./RiskWorkspace";
import type { RiskLocation } from "./presentation";
import styles from "./RiskDrawer.module.css";
export function RiskDrawer({
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
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.root}
      aria-label={t("迁移风险与策略")}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.drawer}>
        <header>
          <div>
            <h2>{t("迁移风险与策略")}</h2>
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
            aria-label={t("关闭风险抽屉")}
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
            drawer
            location={location}
            onLocationChange={onLocationChange}
            onManage={onManage}
          />
        </div>
      </div>
    </dialog>
  );
}
