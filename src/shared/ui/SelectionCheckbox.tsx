export function SelectionCheckbox({
  label,
  checked,
  mixed = false,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  mixed?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      aria-checked={mixed ? "mixed" : checked}
      checked={checked}
      disabled={disabled}
      ref={(node) => {
        if (node) node.indeterminate = mixed;
      }}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
