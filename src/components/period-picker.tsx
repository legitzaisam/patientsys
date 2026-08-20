import { cn } from "@/lib/utils";

export type PeriodKey = "month" | "last" | "year";

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "last", label: "Last month" },
  { key: "year", label: "This year" },
];

/** Inclusive ISO range for the selected period. */
export function periodRange(period: PeriodKey): { from: string; to: string } {
  const now = new Date();
  if (period === "last") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString(),
    };
  }
  if (period === "year") {
    return {
      from: new Date(now.getFullYear(), 0, 1).toISOString(),
      to: new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString(),
    };
  }
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
  };
}

export function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (v: PeriodKey) => void;
}) {
  return (
    <div className="flex h-[34px] items-center rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "h-7 cursor-pointer rounded-full px-3.5 text-xs transition-colors",
            value === o.key
              ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
              : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}