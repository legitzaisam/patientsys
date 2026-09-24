import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ChevronRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The patient portal's building blocks, ported from the V4 wireframes.
 *
 * V4's stylesheet was itself lifted from the clinic portal's tokens, so these
 * map onto the app's existing Tailwind utilities with no visual drift — the
 * portal and the staff app share one palette, one glass treatment and one
 * type scale.
 */

export function PortalCard({
  children,
  className,
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  "data-qc"?: string;
}) {
  return (
    // Inside an items-stretch grid every card in a row takes the row's height
    // on its own; no explicit height here, so a card on its own stays the
    // size of its content.
    <Card className={cn("rounded-[22px] p-[14px]", className)} style={style} {...rest}>
      {children}
    </Card>
  );
}

/** Card heading: icon plus title on the left, optional action on the right. */
export function PortalHead({
  icon: Icon,
  title,
  sub,
  action,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden />}
      <div className="min-w-0">
        <h2 className="section-title">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}

export function PortalLink({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  /** External destination; rendered as a real link that opens in a new tab. */
  href?: string;
}) {
  const className = "inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-accent-ink hover:underline";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
        <ArrowRight className="h-3 w-3" aria-hidden />
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
      <ArrowRight className="h-3 w-3" aria-hidden />
    </button>
  );
}

/** Progress ring used for plan completion and routine adherence. */
export function PortalRing({
  pct,
  size = 56,
  stroke = 6,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} data-qc="portal-ring">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bar)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--success)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">
        {children ?? `${pct}%`}
      </div>
    </div>
  );
}

/** One of the four tiles across the top of the portal home. */
export function PortalTile({
  icon: Icon,
  iconClass = "bg-accent-soft text-accent-ink",
  lead,
  label,
  value,
  sub,
  onClick,
}: {
  icon?: LucideIcon;
  iconClass?: string;
  lead?: ReactNode;
  label?: string;
  value: ReactNode;
  sub?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-card block cursor-pointer rounded-[22px] p-[14px] text-left transition-shadow hover:shadow-lift"
    >
      <div className="flex items-center gap-2.5">
        {lead ??
          (Icon ? (
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[10px]", iconClass)}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          ) : null)}
        <div className="min-w-0 flex-1">
          {label && <p className="text-xs text-muted-foreground">{label}</p>}
          <p className="mt-px truncate text-[13.5px] font-semibold tracking-[-0.01em]">{value}</p>
          {sub && <p className="mt-px truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />
      </div>
    </button>
  );
}

/**
 * Severity slider from a recovery check-in. Read-only by default; pass
 * `onChange` to make it draggable and `onCommit` to persist when the patient
 * lets go. A native range input sits invisibly over the track so it is
 * keyboard- and screen-reader-operable without a custom widget.
 */
export function PortalSlider({
  label,
  value,
  reading,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  reading: string;
  onChange?: ((value: number) => void) | undefined;
  onCommit?: ((value: number) => void) | undefined;
}) {
  const interactive = Boolean(onChange);
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[66px] shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("relative h-1.5 flex-1", interactive && "group cursor-pointer")}>
        <span className="absolute inset-0 overflow-hidden rounded-full bg-bar">
          <span className="block h-full rounded-full bg-success" style={{ width: `${value}%` }} />
        </span>
        <span
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success shadow-glass ring-2 ring-white transition-transform",
            interactive && "group-hover:scale-110 group-focus-within:scale-110",
          )}
          style={{ left: `${value}%` }}
        />
        {interactive ? (
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            aria-label={`${label}: ${reading}`}
            aria-valuetext={reading}
            onChange={(e) => onChange?.(Number(e.target.value))}
            onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
            onBlur={(e) => onCommit?.(Number(e.target.value))}
            className="absolute -inset-y-2.5 inset-x-0 m-0 w-full cursor-pointer opacity-0"
          />
        ) : null}
      </span>
      <span className="w-[54px] shrink-0 text-right text-xs text-muted-foreground">{reading}</span>
    </div>
  );
}

/** The soft encouragement strip at the foot of several pages. */
export function PortalBanner({
  icon: Icon,
  title,
  body,
  cta,
  onCta,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    // Extra right padding keeps the CTA clear of the dock bubbles, which own
    // the bottom-right corner on every portal page.
    <div className="glass-card flex items-center gap-3 rounded-[22px] bg-accent-wash py-3 pl-4 pr-4 xl:pr-28">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="mt-px text-xs text-muted-foreground">{body}</p>
      </div>
      {cta && (
        <button
          type="button"
          onClick={onCta}
          className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-glass-hi px-3 text-xs font-semibold shadow-inset-hi hover:bg-white"
        >
          {cta}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * Stand-in for clinic and product photography, which the portal has no
 * assets for. A tinted block reads as deliberate rather than broken.
 */
export function PortalPhoto({
  icon: Icon,
  height = 92,
  label,
  className,
}: {
  icon: LucideIcon;
  height?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-[14px] shadow-inset-hi",
        "bg-[linear-gradient(145deg,var(--accent-hi),rgba(244,206,190,0.55)_60%,rgba(190,224,244,0.5))]",
        "text-[rgba(47,63,102,0.28)]",
        className,
      )}
      style={{ height }}
    >
      <span className="relative z-[1] grid place-items-center gap-1">
        <Icon className={height > 70 ? "h-5 w-5" : "h-4 w-4"} aria-hidden />
        {label && <span className="text-2xs uppercase tracking-[0.06em]">{label}</span>}
      </span>
    </div>
  );
}

/** Info / warning callout used under the check-in and inside the pause modal. */
export function PortalNote({
  tone = "sky",
  icon: Icon,
  children,
}: {
  tone?: "sky" | "danger" | "success";
  icon: LucideIcon;
  children: ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "bg-destructive-bg text-destructive-ink"
      : tone === "success"
        ? "bg-success-bg text-success-ink"
        : "bg-sky-bg text-sky-ink";
  return (
    <div className={cn("flex gap-2 rounded-[13px] px-3 py-2.5 text-xs leading-relaxed", toneClass)}>
      <Icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Milestone tick used across the journey snapshot and checklists. */
export function PortalCheck({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-[5px]",
        on ? "bg-success text-white" : "bg-glass-2 text-transparent shadow-[inset_0_0_0_1px_var(--edge-2)]",
        className ?? "h-4 w-4",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3.2}>
        <path d="M5 12.5 10 17.5 19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Status chip vocabulary shared by the timeline and plan progress. */
export function PortalStatus({ status, label }: { status: string; label: string }) {
  const tone =
    status === "done"
      ? "bg-success-bg text-success-ink"
      : status === "current"
        ? "bg-accent-soft text-accent-ink"
        : "bg-glass-2 text-muted-foreground shadow-[inset_0_0_0_1px_var(--edge-2)]";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-semibold", tone)}>
      {label}
    </span>
  );
}

export function formatPortalDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
