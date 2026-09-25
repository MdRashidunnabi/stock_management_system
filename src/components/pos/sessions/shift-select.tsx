import { SHIFT_CODES, SHIFT_LABELS, type ShiftCode } from "@/lib/pos/shifts";

export function ShiftSelect({
  id,
  name,
  value,
  defaultValue,
  onChange,
  required,
}: {
  id?: string;
  name?: string;
  value?: ShiftCode;
  defaultValue?: ShiftCode;
  onChange?: (value: ShiftCode) => void;
  required?: boolean;
}) {
  const className = "border-input bg-background h-10 w-full rounded-md border px-3 text-sm";
  const options = SHIFT_CODES.map((code) => (
    <option key={code} value={code}>
      {SHIFT_LABELS[code]}
    </option>
  ));

  if (onChange) {
    return (
      <select
        id={id}
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value as ShiftCode)}
        className={className}
      >
        {options}
      </select>
    );
  }

  return (
    <select
      id={id}
      name={name}
      required={required}
      defaultValue={defaultValue ?? value}
      className={className}
    >
      {options}
    </select>
  );
}
