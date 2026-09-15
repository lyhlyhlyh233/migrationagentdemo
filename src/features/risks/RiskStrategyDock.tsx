import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./RiskStrategyDock.module.css";

/** One non-modal editing surface shared by rule, VM and bulk actions. */
export function RiskStrategyDock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className={styles.root} aria-labelledby={titleId}>
      <h3 id={titleId} ref={heading} tabIndex={-1}>
        {title}
      </h3>
      {children}
    </section>
  );
}
