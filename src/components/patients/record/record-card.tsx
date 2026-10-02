import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The Overview's card anatomy: a header with a 30px icon tile, a 15px title
 * and meta on the right; the body; and a footer pinned to the bottom behind a
 * hairline, so the four summary cards line up in their equal-height grid.
 */
export type RecordCardTone = "success" | "sky" | "warning" | "journal" | "accent";

const TILE: Record<RecordCardTone, string> = {
  success: "bg-success-bg text-success-ink",
  sky: "bg-sky-bg text-sky-ink",
  warning: "bg-warning-bg text-warning-ink",
  journal: "bg-[rgba(239,155,196,0.3)] text-aftercare-ink",
  accent: "bg-accent-soft text-accent-ink",
};

export function RecordCard({
  icon,
  tone,
  title,
  meta,
  children,
  footer,
  className,
  bodyClassName,
  ...rest
}: {
  icon: ReactNode;
  tone: RecordCardTone;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <section
      className={cn("glass-card flex flex-col gap-3.5 px-[22px] pb-4 pt-5", className)}
      {...rest}
    >
      <header className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] text-sm font-semibold shadow-inset-hi [&_svg]:h-4 [&_svg]:w-4",
            TILE[tone],
          )}
          aria-hidden
        >
          {icon}
        </span>
        <h3 className="min-w-0 flex-1 text-[15px] font-medium tracking-[-0.005em] text-foreground">
          {title}
        </h3>
        {meta ? <span className="whitespace-nowrap text-xs text-ink-2">{meta}</span> : null}
      </header>
      <div className={cn("flex min-h-0 flex-1 flex-col gap-3.5", bodyClassName)}>{children}</div>
      {footer ? (
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2 border-t border-edge-2 pt-3">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

/** The footer's text-only actions: no background, no outline, underline on hover. */
export const recordLinkClass =
  "cursor-pointer whitespace-nowrap text-[12.5px] font-medium text-accent-ink hover:underline disabled:cursor-default disabled:opacity-60";

/** A row inside a card: white wash, hairline border, 16px radius. */
export const recordRowClass =
  "rounded-2xl border border-edge-2 bg-[rgba(255,255,255,0.6)] px-3 py-2.5";
