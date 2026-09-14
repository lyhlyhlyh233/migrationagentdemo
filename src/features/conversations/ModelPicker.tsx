import type { CatalogOption } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { Select } from "@/shared/ui/Select";
export function ModelPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: CatalogOption[];
  onChange: (value: string) => void;
}) {
  const t = useTranslation();
  return (
    <div className="composer-model-picker">
      <span className="composer-select-control">
        <Select
          aria-label={t("切换对话模型")}
          title={t(options.find((o) => o.id === value)?.label ?? value)}
          value={value}
          onValueChange={onChange}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {t(o.label)}
            </option>
          ))}
        </Select>
      </span>
    </div>
  );
}
