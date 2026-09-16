import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "./icons";
import styles from "./ConfirmationChoices.module.css";

export interface ConfirmationChoice {
  value: string;
  title: string;
  description: string;
  recommended?: boolean;
  disabled?: boolean;
}

/** Visible choices shared by conversation confirmations. It never executes an operation. */
export function ConfirmationChoices({
  options,
  value,
  onChange,
  disabled = false,
  label = "选择处理方式",
}: {
  options: ConfirmationChoice[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const t = useTranslation();
  const id = useId();
  return (
    <fieldset
      className={styles.options}
      disabled={disabled}
      aria-label={t(label)}
    >
      {options.map((option, index) => (
        <label key={option.value} className={styles.option}>
          <input
            type="radio"
            name={id}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          <span className={styles.number} aria-hidden="true">
            {index + 1}
          </span>
          <span className={styles.copy}>
            <span className={styles.title}>
              {t(option.title)}
              {option.recommended && (
                <span className={styles.recommended}>{t("推荐")}</span>
              )}
            </span>
            <span className={styles.description}>{t(option.description)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function ConfirmationNote({
  value,
  onChange,
  disabled = false,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslation();
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [value]);
  return (
    <div className={styles.note}>
      <div className={styles.noteField}>
        <Icon name="edit" size={17} />
        <textarea
          ref={textarea}
          id={id}
          aria-label={t("补充说明（可选）")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={1}
          placeholder={t("补充说明（可选）")}
          title={t("补充当前选择的说明，不会作为额外操作指令。")}
        />
      </div>
      {children && <div className={styles.noteActions}>{children}</div>}
    </div>
  );
}
