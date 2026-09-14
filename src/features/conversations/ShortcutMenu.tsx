import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { useEffect, useRef } from "react";
export interface QuickGroup {
  label: string;
  icon: string;
  options: { label: string; description: string; onClick: () => void }[];
}

export function ShortcutMenu({ groups }: { groups: QuickGroup[] }) {
  const t = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (
        event instanceof MouseEvent &&
        root.current?.contains(event.target as Node)
      )
        return;
      root.current
        ?.querySelectorAll("details[open]")
        .forEach((item) => item.removeAttribute("open"));
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <div className="shortcut-groups" ref={root}>
      {groups.map((group) => (
        <details
          key={group.label}
          name="stage-shortcuts"
          className="shortcut-menu"
        >
          <summary>
            <Icon name={group.icon} size={15} />
            <span>{t(group.label)}</span>
            <Icon name="chevron" size={13} />
          </summary>
          <div className="shortcut-options">
            {group.options.map((option) => (
              <button
                key={option.label}
                onClick={(event) => {
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open");
                  option.onClick();
                }}
              >
                <strong>{t(option.label)}</strong>
                <small>{t(option.description)}</small>
              </button>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
