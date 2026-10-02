import { severityTone } from "@/lib/patients/record-overview";
import { severityLabel } from "@/lib/portal/shape";
import { cn } from "@/lib/utils";

/**
 * A recovery check-in's three readings as read-only bars, the portal's
 * severity words beside them: Severe in destructive, Moderate in the no-show
 * peach, Mild in success. Pure display; the patient's slider lives in the portal.
 */
const FILL = { severe: "bg-destructive", moderate: "bg-noshow", mild: "bg-success" } as const;
const INK = {
  severe: "text-destructive-ink",
  moderate: "text-noshow-ink",
  mild: "text-success-ink",
} as const;

export function SeverityWord({ value, className }: { value: number; className?: string }) {
  const tone = severityTone(value);
  return (
    <span className={cn(tone === "mild" ? "font-normal" : "font-semibold", INK[tone], className)}>
      {severityLabel(value)}
    </span>
  );
}

export function SeverityBars({
  redness,
  sensitivity,
  dryness,
  className,
}: {
  redness: number;
  sensitivity: number;
  dryness: number;
  className?: string;
}) {
  const rows: [string, number][] = [
    ["Redness", redness],
    ["Sensitivity", sensitivity],
    ["Dryness", dryness],
  ];
  return (
    <div className={cn("flex flex-col gap-[7px] text-xs text-foreground", className)}>
      {rows.map(([label, value]) => {
        const tone = severityTone(value);
        return (
          <div key={label} className="grid grid-cols-[72px_minmax(0,1fr)_62px] items-center gap-2">
            <span>{label}</span>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[rgba(192,200,210,0.42)]"
              role="meter"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              <div
                className={cn("h-full rounded-full", FILL[tone])}
                style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
              />
            </div>
            <SeverityWord value={value} />
          </div>
        );
      })}
    </div>
  );
}
