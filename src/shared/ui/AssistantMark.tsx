import styles from "./AssistantMark.module.css";

/** Static identity shared by the management discussion header and replies. */
export function AssistantMark({ size = 24 }: { size?: 24 | 48 }) {
  return (
    <span
      className={styles.mark}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" fill="none" focusable="false">
        <path className={styles.primary} d="M10 21v6m7-14v22m7-17v12" />
        <path className={styles.secondary} d="M31 11v26m7-17v8" />
      </svg>
    </span>
  );
}
