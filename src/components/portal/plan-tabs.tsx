import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS: { to: string; label: string; exact?: boolean }[] = [
  { to: "/my-record/plan", label: "Overview", exact: true },
  { to: "/my-record/plan/timeline", label: "Timeline" },
  { to: "/my-record/plan/journal", label: "Journal" },
  { to: "/my-record/plan/routine", label: "Skincare Routine" },
];

/**
 * The four plan tabs, rendered with the clinic portal's segmented pill so the
 * patient surface and the staff surface use one control vocabulary.
 */
export function PlanTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div
      className="mb-3.5 inline-flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
      role="tablist"
      aria-label="Skin plan sections"
    >
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
        return (
          <Link
            key={t.to}
            to={t.to as never}
            role="tab"
            aria-selected={active}
            className={cn(
              "flex h-7 cursor-pointer items-center rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors",
              active
                ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
