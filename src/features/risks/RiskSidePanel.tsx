import { useEffect, useRef, useState, useId } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import type { ProjectCommand } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { RiskWorkspace } from "./RiskWorkspace";
import type { RiskLocation } from "./presentation";
import styles from "./RiskSidePanel.module.css";
export function RiskSidePanel({
  onWidthChange,
  snapshot,
  onCommand,
  onClose,
  onManage,
  location,
  onLocationChange,
}: {
  onWidthChange: (width: number) => void;
  snapshot: ProjectSnapshot;
  onCommand: (cmd: ProjectCommand) => Promise<boolean>;
  onClose: () => void;
  onManage: (location: RiskLocation) => void;
  location: RiskLocation;
  onLocationChange: (location: RiskLocation) => void;
}) {
  const t = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelId = useId();
  const [resizing, setResizing] = useState(false);
  const [size, setSize] = useState({ width: 560, max: 560 });
  const pointerOffset = useRef(0);
  useEffect(() => {
    const element = panel.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const observer = new ResizeObserver(() => {
      const navWidth = parseFloat(getComputedStyle(parent).gridTemplateColumns);
      const max = Math.max(560, parent.clientWidth - navWidth - 360);
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
    onWidthChange(Math.round(Math.max(560, Math.min(size.max, width))));
  useEffect(() => {
    const origin = document.activeElement;
    heading.current?.focus({ preventScroll: true });
    return () => {
      if (origin instanceof HTMLElement && origin.isConnected)
        origin.focus({ preventScroll: true });
    };
  }, []);
  return (
    <aside
      ref={panel}
      id={panelId}
      className={styles.root}
      aria-label={t("迁移风险与策略")}
    >
      <div
        className={styles.resizeHandle}
        role="separator"
        tabIndex={0}
        aria-label={t("调整风险面板宽度")}
        aria-orientation="vertical"
        aria-controls={panelId}
        aria-valuemin={560}
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
              ? 560
              : event.key === "End"
                ? size.max
                : size.width + (event.key === "ArrowLeft" ? 24 : -24),
          );
        }}
      />
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
