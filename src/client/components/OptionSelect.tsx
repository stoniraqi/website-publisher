import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";

export interface Option {
  value: string;
  label: string;
}

/** A labelled choice from a short list. */
export function OptionSelect({
  value,
  options,
  onChange,
  label,
  testId,
  disabled,
  className,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  label: string;
  testId?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next);
      }}
    >
      <SelectTrigger aria-label={label} data-testid={testId} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
