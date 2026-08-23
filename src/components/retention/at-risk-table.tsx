import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RiskBadge, type RiskLevel } from "./risk-badge";
import { SendRecallDialog } from "./send-recall-dialog";
import { StaffTaskHoverCard } from "./staff-task-hovercard";
import { money } from "@/components/period-picker";
import { cn } from "@/lib/utils";

export type AtRiskRow = {
  patientId: string;
  name: string;
  risk: RiskLevel;
  lastTreatment: string | null;
  lastVisit: string | null;
  daysSince: number | null;
  nextDue: string | null;
  practitioner: string | null;
  practitionerId: string | null;
  visits: number;
  contactedAt: string | null;
  lifetimeValue: number;
  email?: string | null;
  phone?: string | null;
};

const FILTERS: { key: RiskLevel | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "lapsing", label: "Lapsing" },
  { key: "lost", label: "Lost" },
];

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "—";
}

/** Contacted within the last 30 days — hidden from the recall list by default. */
function recentlyContacted(row: AtRiskRow) {
  return !!row.contactedAt && Date.now() - new Date(row.contactedAt).getTime() < 30 * 86400000;
}

export function AtRiskTable({
  rows,
  filter,
  onFilterChange,
  onContacted,
  pendingId,
  canAssign = false,
}: {
  rows: AtRiskRow[];
  filter: RiskLevel | "all";
  onFilterChange: (f: RiskLevel | "all") => void;
  onContacted: (patientId: string) => void;
  pendingId?: string | null;
  canAssign?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showContacted, setShowContacted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searching = searchOpen || !!search.trim();

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  function closeSearch() {
    setSearch("");
    setSearchOpen(false);
  }

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.risk !== filter) return false;
      if (!showContacted && recentlyContacted(r)) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, filter, search, showContacted]);

  const hiddenCount = rows.filter(recentlyContacted).length;

  return (
    <Card className="p-5">
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="min-w-0 section-title">
            Patients at risk
          </h2>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            <div
              className={cn(
                "relative h-9 overflow-hidden rounded-full border border-edge bg-glass-2 shadow-inset-hi transition-[width,border-color,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                searching
                  ? "w-[180px] focus-within:border-accent-deep"
                  : "w-9 hover:border-accent-line hover:bg-accent-wash hover:shadow-lift",
              )}
            >
              <Search className="pointer-events-none absolute left-[11px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    closeSearch();
                  }
                }}
                onBlur={() => {
                  if (!search.trim()) setSearchOpen(false);
                }}
                placeholder={searching ? "Search by name" : ""}
                tabIndex={searching ? 0 : -1}
                className="h-9 w-[180px] rounded-full border-0 bg-transparent pl-[34px] pr-8 shadow-none focus-visible:border-transparent focus-visible:ring-0"
                aria-label="Search patients at risk"
                aria-expanded={searching}
              />
              {!searching && (
                <button
                  type="button"
                  className="absolute inset-0 rounded-full"
                  aria-label="Search patients at risk"
                  onClick={() => setSearchOpen(true)}
                />
              )}
              <button
                type="button"
                aria-label="Clear search"
                tabIndex={searching ? 0 : -1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={closeSearch}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-opacity duration-200 hover:text-foreground",
                  searching ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div
              role="tablist"
              className="inline-flex h-9 items-center justify-center gap-0.5 rounded-full border border-edge bg-glass-2 p-1 text-ink-2 shadow-inset-hi"
            >
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => onFilterChange(f.key)}
                  className={cn(
                    "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-3.5 py-1 text-[12.5px] font-medium transition-all hover:text-foreground",
                    filter === f.key
                      ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                      : "text-ink-2",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Overdue for a treatment, or not seen recently, with nothing booked in the diary.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="glass-table w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Last treatment</th>
              <th className="px-4 py-3">Last seen</th>
              <th className="px-4 py-3">Next due</th>
              <th className="px-4 py-3">Practitioner</th>
              <th className="px-4 py-3">Visits</th>
              <th className="px-4 py-3">Lifetime value</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.patientId} className="border-b border-glass-line last:border-0">
                <td className="px-4 py-3">
                  <Link
                    to="/patients/$id"
                    params={{ id: r.patientId }}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.lastTreatment ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {date(r.lastVisit)}
                  {r.daysSince !== null && (
                    <span className="ml-1 text-2xs">({r.daysSince}d)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{date(r.nextDue)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {canAssign ? (
                    <StaffTaskHoverCard
                      patientId={r.patientId}
                      patientName={r.name}
                      practitionerId={r.practitionerId}
                      practitionerName={r.practitioner}
                      treatment={r.lastTreatment}
                    >
                      {r.practitionerId ? (
                        <Link
                          to="/team/$id" search={{}}
                          params={{ id: r.practitionerId }}
                          className="underline-offset-4 hover:underline"
                        >
                          {r.practitioner ?? "—"}
                        </Link>
                      ) : (
                        <span className="cursor-default underline-offset-4 hover:underline">
                          {r.practitioner ?? "—"}
                        </span>
                      )}
                    </StaffTaskHoverCard>
                  ) : r.practitionerId ? (
                    <Link
                      to="/team/$id" search={{}}
                      params={{ id: r.practitionerId }}
                      className="underline-offset-4 hover:underline"
                    >
                      {r.practitioner ?? "—"}
                    </Link>
                  ) : (
                    r.practitioner ?? "—"
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.visits}</td>
                <td className="px-4 py-3 text-muted-foreground">{money(r.lifetimeValue)}</td>
                <td className="px-4 py-3">
                  <RiskBadge risk={r.risk} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <SendRecallDialog
                      patientId={r.patientId}
                      patientName={r.name}
                      patientFirstName={r.name.split(" ")[1] ?? r.name.split(" ")[0] ?? ""}
                      email={r.email ?? null}
                      phone={r.phone ?? null}
                      treatment={r.lastTreatment}
                      dueDate={r.nextDue}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                     
                      disabled={pendingId === r.patientId}
                      onClick={() => onContacted(r.patientId)}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      {recentlyContacted(r) ? "Contacted" : "Mark contacted"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr className="hover:bg-transparent">
                <td colSpan={9} className="p-2">
                  <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-accent-wash hover:text-foreground">
                    Nobody to chase here — everyone is booked in or recently seen.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowContacted((v) => !v)}
          className="mt-4 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {showContacted ? "Hide" : "Show"} {hiddenCount} patient{hiddenCount === 1 ? "" : "s"} contacted in the last 30 days
        </button>
      )}
    </Card>
  );
}
