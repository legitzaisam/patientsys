import { cn } from "@/lib/utils";
import type { ProfileTabKey } from "./profile-types";

export type ProfileTabDef = { key: ProfileTabKey; label: string; badge?: string | null };

/**
 * The page's content tabs: a full-width pill track under the hero (exempt
 * from the right-of-title rule since there is no title beside it). Scrolls
 * sideways on phones rather than wrapping.
 */
export function ProfileTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: ProfileTabDef[];
  value: ProfileTabKey;
  onChange: (tab: ProfileTabKey) => void;
}) {
  return (
    <div className="scroll-x-plain -mx-1 max-w-full px-1 py-0.5">
      <div
        role="tablist"
        aria-label="My profile sections"
        className="inline-flex h-[42px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-1 shadow-inset-hi"
        data-qc="profile-tabs"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={value === tab.key}
            onClick={() => onChange(tab.key)}
            data-qc={`profile-tab-${tab.key}`}
            className={cn(
              "inline-flex h-[34px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] tracking-[0.01em] transition-colors",
              value === tab.key
                ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
            )}
          >
            {tab.label}
            {tab.badge ? (
              <span className="rounded-full bg-destructive-bg px-2 py-0.5 text-2xs font-bold text-destructive-ink">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
