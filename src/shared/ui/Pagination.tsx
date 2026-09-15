import { useTranslation } from "@/shared/i18n";
import { Button } from "./primitives";
import { Select } from "./Select";
import { pageWindow, type PageState } from "./pagination-state";
import styles from "./Pagination.module.css";

export function Pagination({
  total,
  value,
  onChange,
  label,
  disabled = false,
  compact = false,
}: {
  total: number;
  value: PageState;
  onChange: (value: PageState) => void;
  label: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslation();
  const range = pageWindow(total, value);
  if (compact && total <= 10)
    return (
      <nav className={styles.compact} aria-label={label}>
        {t("共 {0} 项", total)}
      </nav>
    );
  return (
    <nav className={styles.root} aria-label={label}>
      <span>
        {t(
          "第 {0}–{1} 项，共 {2} 项",
          total ? range.start + 1 : 0,
          range.end,
          total,
        )}
      </span>
      <Select
        aria-label={t("{0}每页条数", label)}
        value={String(value.size)}
        disabled={disabled}
        onValueChange={(size) => onChange({ page: 1, size: Number(size) })}
      >
        {[10, 20, 50].map((size) => (
          <option key={size} value={size}>
            {t("{0} 条／页", size)}
          </option>
        ))}
      </Select>
      {range.pages > 1 && (
        <>
          <Button
            aria-label={t("{0}上一页", label)}
            disabled={disabled || range.page === 1}
            onClick={() => onChange({ ...value, page: range.page - 1 })}
          >
            {t("上一页")}
          </Button>
          <span>
            {range.page} / {range.pages}
          </span>
          <Button
            aria-label={t("{0}下一页", label)}
            disabled={disabled || range.page === range.pages}
            onClick={() => onChange({ ...value, page: range.page + 1 })}
          >
            {t("下一页")}
          </Button>
        </>
      )}
    </nav>
  );
}
