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
    <div className="flex rounded-full border border-edge-2 bg-glass-2 p-1 shadow-inset-hi">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors",
            value === o.key
              ? "bg-gradient-to-br from-accent-hi to-accent to-75% font-semibold text-accent-foreground shadow-bloom"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}