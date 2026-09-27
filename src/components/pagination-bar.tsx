import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Client-side paging over an already-loaded list. Resets to page 1 when the
 * list shrinks under the current page (a filter or search changed).
 */
export function usePagination<T>(items: readonly T[], pageSize: number, initialPage = 1) {
  const [page, setPage] = useState(Math.max(1, initialPage));
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const current = Math.min(page, pageCount);
  const rows = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );
  return {
    page: current,
    pageCount,
    total,
    pageSize,
    rows,
    from: total === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(total, current * pageSize),
    setPage: (next: number) => setPage(Math.min(pageCount, Math.max(1, next))),
  };
}

/**
 * First / previous / next / last with a "Showing a–b of N" caption. Hidden
 * when everything fits on one page.
 */
export function PaginationBar({
  page,
  pageCount,
  total,
  from,
  to,
  onPage,
  noun = "results",
  className,
  qc = "pagination",
}: {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPage: (page: number) => void;
  /** Plural noun for the caption ("patients", "treatments"). */
  noun?: string;
  className?: string;
  qc?: string;
}) {
  if (pageCount <= 1) return null;
  const btn = "h-8 w-8 rounded-full text-ink-2 hover:text-foreground disabled:opacity-40";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-xs text-muted-foreground",
        className,
      )}
      data-qc={qc}
    >
      <span data-qc={`${qc}-caption`}>
        Showing {from}–{to} of {total} {noun}
      </span>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={btn}
          aria-label="First page"
          disabled={page <= 1}
          onClick={() => onPage(1)}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={btn}
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span
          className="min-w-[5.5rem] text-center tabular-nums text-foreground"
          data-qc={`${qc}-page`}
        >
          Page {page} of {pageCount}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={btn}
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={btn}
          aria-label="Last page"
          disabled={page >= pageCount}
          onClick={() => onPage(pageCount)}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
