import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./primitives.module.css";
export function Button({
  primary = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      className={`${styles.button} ${primary ? styles.primary : ""} ${className}`}
      {...props}
    />
  );
}
export function FileField({
  label,
  filename,
  onFile,
  disabled = false,
  labelAction,
}: {
  label: string;
  filename?: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  labelAction?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={styles.file}>
      <div className={styles.fileHeading}>
        <label htmlFor={id}>{label}</label>
        {labelAction}
      </div>
      <input
        id={id}
        type="file"
        accept=".xlsx,.xls,.csv"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <small>{filename || "XLSX / XLS / CSV"}</small>
    </div>
  );
}
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function ResultFrame({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={styles.result}>
      <header>{title}</header>
      <div>{children}</div>
      {actions && <footer>{actions}</footer>}
    </section>
  );
}
export function TableContainer({ children }: { children: ReactNode }) {
  return <div className={styles.table}>{children}</div>;
}
