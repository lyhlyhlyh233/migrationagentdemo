import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import styles from "./WorkspaceSidePanel.module.css";

export function WorkspaceSidePanel({
  open,
  onWidthChange,
  onCollapse,
  onClose,
  onManage,
  manageDisabled,
  risks,
}: {
  open: boolean;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
  onClose: () => void;
  risks: ReactNode;
  onManage: () => void;
  manageDisabled: boolean;
}) {
  const t = useTranslation();
  const panel = useRef<HTMLElement>(null);
  const panelId = useId();
  const [resizing, setResizing] = useState(false);
  const [size, setSize] = useState({ width: 420, max: 420 });
  const pointerOffset = useRef(0);
  useEffect(() => {
    const element = panel.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const observer = new ResizeObserver(() => {
      const navWidth = parseFloat(getComputedStyle(parent).gridTemplateColumns);
      const max = Math.max(420, parent.clientWidth - navWidth - 360);
      setSize({
        width: Math.round(element.getBoundingClientRect().width),
        max: Math.round(max),
      });
    });
    observer.observe(parent);
    observer.observe(element);
    // The chat changes width when the navigation rail is collapsed.
    if (element.previousElementSibling)
      observer.observe(element.previousElementSibling);
    return () => observer.disconnect();
  }, []);
  const resize = (width: number) =>
    onWidthChange(Math.round(Math.max(420, Math.min(size.max, width))));
  return (
    <aside
      ref={panel}
      id={panelId}
      className={`${styles.root} workspace-side-panel`}
      hidden={!open}
      aria-label={t("工作区侧面板")}
    >
      <div
        className={styles.resizeHandle}
        role="separator"
        tabIndex={0}
        aria-label={t("调整侧面板宽度")}
        aria-orientation="vertical"
        aria-controls={panelId}
        aria-valuemin={420}
        aria-valuemax={size.max}
        aria-valuenow={size.width}
        aria-valuetext={t("面板宽度 {0} 像素", size.width)}
        title={t("拖动调整宽度，或使用左右方向键")}
        data-resizing={resizing}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          pointerOffset.current =
            event.clientX - panel.current!.getBoundingClientRect().left;
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizing(true);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          resize(
            panel.current!.getBoundingClientRect().right -
              event.clientX +
              pointerOffset.current,
          );
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          setResizing(false);
        }}
        onPointerCancel={() => setResizing(false)}
        onLostPointerCapture={() => setResizing(false)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          resize(
            event.key === "Home"
              ? 420
              : event.key === "End"
                ? size.max
                : size.width + (event.key === "ArrowLeft" ? 24 : -24),
          );
        }}
      />
      <header className={styles.header}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label={t("侧面板页签")}
        >
          <div className={styles.tabItem} role="presentation">
            <button
              type="button"
              role="tab"
              id={`${panelId}-risks-tab`}
              aria-selected="true"
              aria-controls={`${panelId}-risks`}
              onKeyDown={(event) => {
                if (event.key === "Delete") {
                  event.preventDefault();
                  onClose();
                }
              }}
            >
              <Icon name="shield" size={16} />
              {t("迁移风险")}
            </button>
            <button
              type="button"
              className={styles.closeTab}
              aria-label={t("关闭迁移风险页签")}
              title={t("关闭迁移风险页签")}
              onClick={onClose}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button disabled={manageDisabled} onClick={onManage}>
            {t("打开迁移风险页面")} <Icon name="open" size={14} />
          </Button>
          <button
            type="button"
            className="icon-button"
            aria-label={t("折叠右侧面板")}
            title={t("折叠右侧面板")}
            onClick={onCollapse}
          >
            <Icon name="panel" size={18} />
          </button>
        </div>
      </header>
      <section
        role="tabpanel"
        id={`${panelId}-risks`}
        aria-labelledby={`${panelId}-risks-tab`}
        className={`${styles.content} ${styles.risks}`}
      >
        {risks}
      </section>
    </aside>
  );
}
