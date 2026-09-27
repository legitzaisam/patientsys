import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type LoadStatus = "loading" | "error" | "ready";

/** Placeholder card while a dashboard section is loading: never a "0" or "£0". */
export function LoadingCard({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <div
      className={cn("glass-card p-[18px]", className)}
      aria-busy="true"
      aria-label="Loading"
      data-qc="loading-card"
    >
      <Skeleton className="h-3 w-24 rounded-full bg-foreground/10" />
      <Skeleton className="mt-3 h-7 w-28 rounded-lg bg-foreground/10" />
      {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
        <Skeleton key={i} className="mt-2 h-3 w-36 rounded-full bg-foreground/10" />
      ))}
    </div>
  );
}

/** Short failure line with a retry, in place of the section's content. */
export function LoadError({
  what,
  onRetry,
  className,
}: {
  what: string;
  onRetry?: (() => void) | undefined;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-edge-2 bg-glass-2 px-5 py-4",
        className,
      )}
      data-qc="load-error"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-destructive-ink" aria-hidden />
      <p className="text-sm text-muted-foreground">
        Couldn't load {what}. Check your connection and try again.
      </p>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
