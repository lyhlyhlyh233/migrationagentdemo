import type { SidePanelTab } from "@/app/state";
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
  planning,
  execution,
  validation,
  tabs,
  active,
  onSelect,
}: {
  open: boolean;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
  onClose: (tab: SidePanelTab) => void;
  risks: ReactNode;
  planning: ReactNode;
  execution: ReactNode;
  validation: ReactNode;
  tabs: SidePanelTab[];
  active: SidePanelTab;
  onSelect: (tab: SidePanelTab) => void;
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
          {tabs.map((tab, index) => (
            <div key={tab} className={styles.tabItem} role="presentation">
              <button
                type="button"
                role="tab"
                id={`${panelId}-${tab}-tab`}
                aria-selected={active === tab}
                aria-controls={`${panelId}-${tab}`}
                tabIndex={active === tab ? 0 : -1}
                onClick={() => onSelect(tab)}
                onKeyDown={(event) => {
                  if (event.key === "Delete") {
                    event.preventDefault();
                    onClose(tab);
                  }
                  if (
                    ["ArrowRight", "ArrowLeft", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    const target =
                      tabs[
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : (index +
                                (event.key === "ArrowRight" ? 1 : -1) +
                                tabs.length) %
                              tabs.length
                      ];
                    onSelect(target);
                    document
                      .getElementById(`${panelId}-${target}-tab`)
                      ?.focus();
                  }
                }}
              >
                <Icon name={tab === "risk" ? "shield" : "file"} size={16} />
                {t(
                  {
                    risk: "迁移风险",
                    planning: "规划设计",
                    execution: "迁移实施",
                    validation: "结果验证",
                  }[tab],
                )}
              </button>
              <button
                type="button"
                className={styles.closeTab}
                aria-label={t(
                  `关闭${{ risk: "迁移风险", planning: "规划设计", execution: "迁移实施", validation: "结果验证" }[tab]}页签`,
                )}
                onClick={() => onClose(tab)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className={styles.headerActions}>
          <Button disabled={manageDisabled} onClick={onManage}>
            {t(
              {
                risk: "打开迁移风险页面",
                planning: "打开迁移规划页面",
                execution: "打开迁移任务页面",
                validation: "打开验证结果页面",
              }[active],
            )}{" "}
            <Icon name="open" size={14} />
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
      {tabs.includes("risk") && (
        <section
          role="tabpanel"
          id={`${panelId}-risk`}
          aria-labelledby={`${panelId}-risk-tab`}
          hidden={active !== "risk"}
          className={`${styles.content} ${styles.risks}`}
        >
          {risks}
        </section>
      )}
      {tabs.includes("planning") && (
        <section
          role="tabpanel"
          id={`${panelId}-planning`}
          aria-labelledby={`${panelId}-planning-tab`}
          hidden={active !== "planning"}
          className={styles.content}
        >
          {planning}
        </section>
      )}
      {(["execution", "validation"] as const).map(
        (tab) =>
          tabs.includes(tab) && (
            <section
              key={tab}
              role="tabpanel"
              id={`${panelId}-${tab}`}
              aria-labelledby={`${panelId}-${tab}-tab`}
              hidden={active !== tab}
              className={styles.content}
            >
              {tab === "execution" ? execution : validation}
            </section>
          ),
      )}
    </aside>
  );
}
