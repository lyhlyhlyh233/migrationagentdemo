import { useEffect, useRef } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { RiskPanel } from "./RiskPanel";
import styles from "./RiskDrawer.module.css";
export function RiskDrawer({
  snapshot,
  onCommand,
  onClose,
  onManage,
}: {
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onClose: () => void;
  onManage: () => void;
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
          <span>{snapshot.info?.siteName}</span>
          <button type="button" onClick={onManage}>
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
          <RiskPanel snapshot={snapshot} onCommand={onCommand} />
        </div>
        <footer>{t("无需全部处理。关闭抽屉后，可以直接继续下一阶段。")}</footer>
      </div>
    </dialog>
  );
}
