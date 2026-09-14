import { useTranslation } from "@/shared/i18n";
import type { ReactNode } from "react";
import styles from "./Status.module.css";
export type StatusTone = "neutral" | "success" | "info" | "warning" | "danger";
export function statusTone(value: string): StatusTone {
  return [
    "completed",
    "succeeded",
    "passed",
    "confirmed",
    "created",
    "ready",
    "matched",
    "closed",
  ].includes(value)
    ? "success"
    : [
          "running",
          "syncing",
          "checking",
          "generating",
          "checking-connection",
          "checking-config",
        ].includes(value)
      ? "info"
      : ["high", "failed", "different"].includes(value)
        ? "danger"
        : [
              "medium",
              "pending",
              "unconfigured",
              "pending-sync",
              "pending-check",
              "paused",
            ].includes(value)
          ? "warning"
          : "neutral";
}
export function Status({
  children,
  value = "",
  tone,
}: {
  children?: ReactNode;
  value?: string;
  tone?: StatusTone;
}) {
  const t = useTranslation();
  return (
    <span className={styles.badge} data-tone={tone ?? statusTone(value)}>
      {children ?? t(value)}
    </span>
  );
}
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  const t = useTranslation();
  return (
    <div className={styles.empty}>
      <strong>{t(title)}</strong>
      {detail && <p>{t(detail)}</p>}
      {action}
    </div>
  );
}
