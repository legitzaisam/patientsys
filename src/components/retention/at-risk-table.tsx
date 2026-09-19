import { useEffect, useMemo, useRef, useState } from "react";
import { PatientAvatar } from "@/components/patient-avatar";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from "lucide-react";
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

type SortColumn =
  | "patient"
  | "lastTreatment"
  | "lastSeen"
  | "nextDue"
  | "practitioner"
  | "visits"
  | "lifetimeValue"
  | "risk"
  | "action";
type SortDirection = "asc" | "desc";

const RISK_ORDER: Record<RiskLevel, number> = { overdue: 0, lapsing: 1, lost: 2 };
const LIST_UNLOCK_MS = 1800;
const LIST_MAX_H = "max-h-[calc(45px+7*65px)]";

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "—";
}

/** Contacted within the last 30 days. */
function recentlyContacted(row: AtRiskRow) {
  return !!row.contactedAt && Date.now() - new Date(row.contactedAt).getTime() < 30 * 86400000;
}

function compareText(a: string | null | undefined, b: string | null | undefined) {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

function compareDate(a: string | null | undefined, b: string | null | undefined) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function SortHeader({
  column,
  label,
  sort,
  onSort,
  className,
  align = "start",
}: {
  column: SortColumn;
  label: string;
  sort: { column: SortColumn | null; direction: SortDirection };
  onSort: (column: SortColumn) => void;
  className?: string;
  align?: "start" | "center";
}) {
  const active = sort.column === column;
  const Icon = active ? (sort.direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;

  return (
    <th className={cn("sticky top-0 z-10 whitespace-nowrap bg-glass px-5 py-3 backdrop-blur-glass", className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "flex items-center gap-1.5 font-semibold tracking-[0.02em] text-ink-3 transition-colors hover:text-foreground",
          align === "center" ? "w-full justify-center" : "text-left",
        )}
      >
        <span>{label}</span>
        <Icon
          className={cn("h-3.5 w-3.5 shrink-0", active ? "text-foreground" : "text-muted-foreground/50")}
          aria-hidden="true"
        />
      </button>
    </th>
  );
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
  const [sort, setSort] = useState<{ column: SortColumn | null; direction: SortDirection }>({
    column: null,
    direction: "asc",
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listScrollOnRef = useRef(false);
  const [listScrollOn, setListScrollOn] = useState(false);
  const searching = searchOpen || !!search.trim();

  useEffect(() => {
    listScrollOnRef.current = listScrollOn;
  }, [listScrollOn]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      if (listScrollOnRef.current) return;
      const page = document.getElementById("app-main-scroll");
      if (!page) return;
      page.scrollTop += event.deltaY;
      event.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function clearLinger() {
    if (lingerRef.current) {
      clearTimeout(lingerRef.current);
      lingerRef.current = null;
    }
  }

  function armListScroll() {
    clearLinger();
    lingerRef.current = setTimeout(() => setListScrollOn(true), LIST_UNLOCK_MS);
  }

  function lockListScroll() {
    clearLinger();
    setListScrollOn(false);
  }

  useEffect(() => () => clearLinger(), []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  function closeSearch() {
    setSearch("");
    setSearchOpen(false);
  }

  function onSort(column: SortColumn) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (filter !== "all" && r.risk !== filter) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    if (!sort.column) return filtered;

    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sort.column) {
        case "patient":
          cmp = compareText(a.name, b.name);
          break;
        case "lastTreatment":
          cmp = compareText(a.lastTreatment, b.lastTreatment);
          break;
        case "lastSeen":
          cmp = compareDate(a.lastVisit, b.lastVisit);
          break;
        case "nextDue":
          cmp = compareDate(a.nextDue, b.nextDue);
          break;
        case "practitioner":
          cmp = compareText(a.practitioner, b.practitioner);
          break;
        case "visits":
          cmp = a.visits - b.visits;
          break;
        case "lifetimeValue":
          cmp = a.lifetimeValue - b.lifetimeValue;
          break;
        case "risk":
          cmp = RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
          break;
        case "action":
          cmp = compareDate(a.contactedAt, b.contactedAt);
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
  }, [rows, filter, search, sort]);

  return (
    <Card id="retention-at-risk" className="scroll-mt-20 p-5">
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="min-w-0 section-title">Patients at risk</h2>
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

      <div
        ref={scrollerRef}
        className={cn(
          LIST_MAX_H,
          "-mx-5 overflow-x-auto overscroll-x-contain",
          listScrollOn ? "overflow-y-auto overscroll-y-contain" : "overflow-y-hidden",
        )}
        onMouseEnter={armListScroll}
        onMouseLeave={lockListScroll}
        onFocusCapture={() => {
          clearLinger();
          setListScrollOn(true);
        }}
        onTouchStart={() => {
          clearLinger();
          setListScrollOn(true);
        }}
      >
        <table className="glass-table w-max min-w-full text-sm">
        <thead>
          <tr>
            <SortHeader column="patient" label="Patient" sort={sort} onSort={onSort} className="min-w-[11rem]" />
            <SortHeader column="lastTreatment" label="Last treatment" sort={sort} onSort={onSort} className="min-w-[10.5rem]" />
            <SortHeader column="lastSeen" label="Last seen" sort={sort} onSort={onSort} className="min-w-[9rem]" />
            <SortHeader column="nextDue" label="Next due" sort={sort} onSort={onSort} className="min-w-[8rem]" />
            <SortHeader column="practitioner" label="Practitioner" sort={sort} onSort={onSort} className="min-w-[10rem]" />
            <SortHeader column="visits" label="Visits" sort={sort} onSort={onSort} className="min-w-[6rem]" />
            <SortHeader column="lifetimeValue" label="Lifetime value" sort={sort} onSort={onSort} className="min-w-[10rem]" />
            <SortHeader column="risk" label="Risk" sort={sort} onSort={onSort} className="min-w-[6.5rem]" />
            <SortHeader
              column="action"
              label="Action"
              sort={sort}
              onSort={onSort}
              align="center"
              className="min-w-[16.5rem]"
            />
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.patientId} className="border-b border-glass-line last:border-0">
              <td className="whitespace-nowrap px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <PatientAvatar patientId={r.patientId} name={r.name} size="xs" />
                  <Link
                    to="/patients/$id"
                    params={{ id: r.patientId }}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {r.name}
                  </Link>
                </div>
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{r.lastTreatment ?? "—"}</td>
              <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                {date(r.lastVisit)}
                {r.daysSince !== null && <span className="ml-1 text-2xs">({r.daysSince}d)</span>}
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{date(r.nextDue)}</td>
              <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
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
                        to="/team/$id"
                        search={{}}
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
                    to="/team/$id"
                    search={{}}
                    params={{ id: r.practitionerId }}
                    className="underline-offset-4 hover:underline"
                  >
                    {r.practitioner ?? "—"}
                  </Link>
                ) : (
                  (r.practitioner ?? "—")
                )}
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{r.visits}</td>
              <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{money(r.lifetimeValue)}</td>
              <td className="whitespace-nowrap px-5 py-3">
                <RiskBadge risk={r.risk} />
              </td>
              <td className="whitespace-nowrap px-5 py-3">
                <div className="flex items-center justify-center gap-2">
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
                <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground">
                  Nobody to chase here — everyone is booked in or recently seen.
                </div>
              </td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </Card>
  );
}
