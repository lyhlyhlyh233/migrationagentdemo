import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
export function ProjectResourceButton({
  label,
  icon,
  selected,
  disabled,
  visible,
  count,
  onClick,
}: {
  label: string;
  icon: string;
  selected: boolean;
  disabled: boolean;
  visible: boolean;
  count?: number;
  onClick: () => void;
}) {
  const t = useTranslation();
  const hintId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    maxWidth: number;
  } | null>(null);
  const hintOpen = disabled && visible && position !== null;
  function showHint() {
    if (!disabled || !visible || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    const maxWidth = Math.min(240, window.innerWidth - 24);
    const fitsRight = rect.right + maxWidth + 20 <= window.innerWidth;
    setPosition({
      left: fitsRight
        ? rect.right + 8
        : Math.max(12, Math.min(rect.left, window.innerWidth - maxWidth - 12)),
      top: Math.max(
        12,
        Math.min(
          fitsRight ? rect.top : rect.bottom + 6,
          window.innerHeight - 80,
        ),
      ),
      maxWidth,
    });
  }
  useEffect(() => {
    if (!hintOpen) return;
    const close = () => setPosition(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [hintOpen]);
  return (
    <>
      <button
        ref={button}
        type="button"
        className={selected ? "selected" : ""}
        aria-disabled={disabled || undefined}
        aria-describedby={hintOpen ? hintId : undefined}
        onPointerEnter={showHint}
        onPointerLeave={() => {
          if (!button.current?.matches(":focus-visible")) setPosition(null);
        }}
        onFocus={showHint}
        onBlur={() => setPosition(null)}
        onClick={() => {
          if (disabled) {
            showHint();
            return;
          }
          onClick();
        }}
      >
        <Icon name={icon} size={17} />
        <span>{t(label)}</span>
        {count !== undefined && <span className="nav-count">{t(count)}</span>}
      </button>
      {hintOpen &&
        createPortal(
          <span
            id={hintId}
            role="tooltip"
            className="project-resource-tooltip"
            style={position!}
          >
            {t("创建或选择项目后开启")}
          </span>,
          document.body,
        )}
    </>
  );
}
