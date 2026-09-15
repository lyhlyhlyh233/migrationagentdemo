import styles from "./BrandName.module.css";

export function BrandName() {
  return (
    <span className={styles.name}>
      MigrationDirector <span className={styles.edition}>Ultimate</span>
    </span>
  );
}
