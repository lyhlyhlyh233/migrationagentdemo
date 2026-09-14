import { Icon } from "@/shared/ui/icons";
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface Choice {
  value: string;
  text: string;
  label: ReactNode;
  disabled: boolean;
  group?: string;
}
interface ChoiceProps {
  value?: string | number;
  children?: ReactNode;
  disabled?: boolean;
  label?: string;
}
interface SelectProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "defaultValue" | "children" | "onChange"
> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}
interface Popup {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
  container: HTMLElement;
}

function optionText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<ChoiceProps>(child)
        ? optionText(child.props.children)
        : String(child),
    )
    .join("");
}

function readChoices(
  children: ReactNode,
  group?: string,
  groupDisabled = false,
): Choice[] {
  const result: Choice[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<ChoiceProps>(child)) return;
    if (child.type === Fragment)
      result.push(...readChoices(child.props.children, group, groupDisabled));
    if (child.type === "optgroup")
      result.push(
        ...readChoices(
          child.props.children,
          child.props.label,
          Boolean(child.props.disabled),
        ),
      );
    if (child.type === "option") {
      const text = child.props.label ?? optionText(child.props.children);
      result.push({
        value: String(child.props.value ?? text),
        text,
        label: child.props.label ?? child.props.children,
        disabled: groupDisabled || Boolean(child.props.disabled),
        group,
      });
    }
  });
  return result;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  children,
  className = "",
  disabled,
  id,
  name,
  onKeyDown,
  ...props
}: SelectProps) {
  const choices = readChoices(children);
  const [internalValue, setInternalValue] = useState(
    () => defaultValue ?? choices[0]?.value ?? "",
  );
  const selectedValue = value ?? internalValue;
  const selected =
    choices.find((item) => item.value === selectedValue) ?? choices[0];
  const [popup, setPopup] = useState<Popup | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const uniqueId = useId();
  const triggerId = id ?? `select-${uniqueId}`;
  const menuId = `${triggerId}-menu`;
  const unavailable = disabled || !choices.some((item) => !item.disabled);
  const open = popup !== null && !unavailable;

  function openMenu(position?: "first" | "last") {
    if (unavailable || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 18;
    const above = rect.top - 18;
    const upward =
      below < Math.min(280, choices.length * 38 + 32) && above > below;
    const width = Math.min(Math.max(rect.width, 204), window.innerWidth - 24);
    const current = choices.findIndex(
      (choice) => choice.value === selectedValue && !choice.disabled,
    );
    const enabled = choices
      .map((choice, index) => (choice.disabled ? -1 : index))
      .filter((index) => index >= 0);
    setActiveIndex(
      position === "last"
        ? enabled[enabled.length - 1]
        : position === "first"
          ? enabled[0]
          : current >= 0
            ? current
            : enabled[0],
    );
    setPopup({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      ...(upward
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      width,
      maxHeight: Math.max(48, Math.min(320, upward ? above : below)),
      container: trigger.current.closest("dialog") ?? document.body,
    });
  }

  function choose(index: number) {
    const choice = choices[index];
    if (!choice || choice.disabled || unavailable) return;
    setInternalValue(choice.value);
    setPopup(null);
    trigger.current?.focus({ preventScroll: true });
    onValueChange?.(choice.value);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setPopup(null);
    };
    const onScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) setPopup(null);
    };
    const close = () => setPopup(null);
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => {
    const list = menu.current;
    const item = list?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    if (!open || !list || !item) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    if (itemRect.top < listRect.top + 5)
      list.scrollTop -= listRect.top + 5 - itemRect.top;
    else if (itemRect.bottom > listRect.bottom - 5)
      list.scrollTop += itemRect.bottom - listRect.bottom + 5;
  }, [activeIndex, open]);

  return (
    <>
      <button
        {...props}
        ref={trigger}
        id={triggerId}
        type="button"
        role="combobox"
        className={`ui-select-trigger ${className}`}
        disabled={unavailable}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open ? `${menuId}-${activeIndex}` : undefined}
        onClick={() => (open ? setPopup(null) : openMenu())}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setPopup(null);
            return;
          }
          if (event.key === "Tab") {
            setPopup(null);
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(activeIndex);
            else openMenu();
            return;
          }
          const enabled = choices
            .map((choice, index) => (choice.disabled ? -1 : index))
            .filter((index) => index >= 0);
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            if (!open) {
              openMenu(
                event.key === "Home"
                  ? "first"
                  : event.key === "End"
                    ? "last"
                    : undefined,
              );
              return;
            }
            const current = enabled.indexOf(activeIndex);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? enabled.length - 1
                  : (current +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      enabled.length) %
                    enabled.length;
            setActiveIndex(enabled[next]);
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            const now = Date.now();
            typeahead.current = {
              text: `${now - typeahead.current.at < 700 ? typeahead.current.text : ""}${event.key.toLowerCase()}`,
              at: now,
            };
            const match = choices.findIndex(
              (choice) =>
                !choice.disabled &&
                choice.text.toLowerCase().startsWith(typeahead.current.text),
            );
            if (!open) openMenu();
            if (match >= 0) setActiveIndex(match);
          }
        }}
      >
        <span className="ui-select-value">{selected?.label}</span>
        <Icon name="chevron" size={13} />
      </button>
      {name && (
        <input
          type="hidden"
          name={name}
          value={selectedValue}
          disabled={disabled}
        />
      )}
      {open &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="listbox"
            aria-label={props["aria-label"]}
            aria-labelledby={
              props["aria-label"]
                ? undefined
                : (props["aria-labelledby"] ?? triggerId)
            }
            className="ui-select-menu"
            style={{
              left: popup.left,
              top: popup.top,
              bottom: popup.bottom,
              width: popup.width,
              maxHeight: popup.maxHeight,
            }}
          >
            {choices.map((choice, index) => (
              <Fragment key={`${choice.value}-${index}`}>
                {choice.group && choices[index - 1]?.group !== choice.group && (
                  <div className="ui-select-group">{choice.group}</div>
                )}
                <div
                  id={`${menuId}-${index}`}
                  role="option"
                  aria-selected={choice.value === selectedValue}
                  aria-disabled={choice.disabled || undefined}
                  data-index={index}
                  data-active={index === activeIndex}
                  className="ui-select-option"
                  onPointerMove={() => {
                    if (!choice.disabled) setActiveIndex(index);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  <span>{choice.label}</span>
                  {choice.value === selectedValue && (
                    <Icon name="check" size={14} />
                  )}
                </div>
              </Fragment>
            ))}
          </div>,
          popup.container,
        )}
    </>
  );
}
