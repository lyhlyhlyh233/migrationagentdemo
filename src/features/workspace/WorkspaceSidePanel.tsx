import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import styles from "./WorkspaceSidePanel.module.css";
export type WorkspaceSideTab = "execution" | "risks";
const tabs = [
  { id: "execution", label: "执行详情", icon: "agent" },
  { id: "risks", label: "迁移风险", icon: "shield" },
] as const;

export function WorkspaceSidePanel({
  open,
  activeTab,
  onTabChange,
  onWidthChange,
  onCollapse,
  execution,
  risks,
}: {
  open: boolean;
  activeTab: WorkspaceSideTab;
  onTabChange: (tab: WorkspaceSideTab) => void;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
  execution: ReactNode;
  risks: ReactNode;
}) {
  const t = useTranslation();
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
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
  function selectTab(index: number) {
    onTabChange(tabs[index].id);
    tabButtons.current[index]?.focus();
  }
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
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                tabButtons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${panelId}-${tab.id}-tab`}
              aria-selected={activeTab === tab.id}
              aria-controls={`${panelId}-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                selectTab(
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : (index +
                          (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                        tabs.length,
                );
              }}
            >
              <Icon name={tab.icon} size={16} />
              {t(tab.label)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={t("折叠右侧面板")}
          title={t("折叠右侧面板")}
          onClick={onCollapse}
        >
          <Icon name="panel" size={18} />
        </button>
      </header>
      <section
        role="tabpanel"
        id={`${panelId}-execution`}
        aria-labelledby={`${panelId}-execution-tab`}
        hidden={activeTab !== "execution"}
        className={styles.content}
      >
        {execution}
      </section>
      <section
        role="tabpanel"
        id={`${panelId}-risks`}
        aria-labelledby={`${panelId}-risks-tab`}
        hidden={activeTab !== "risks"}
        className={`${styles.content} ${styles.risks}`}
      >
        {risks}
      </section>
    </aside>
  );
}
