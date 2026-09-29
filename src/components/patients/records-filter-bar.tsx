import { CheckSquare, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { staffLane } from "@/lib/staff-lane";
import { cn } from "@/lib/utils";
import { VIEW_LABEL, type PatientView } from "@/components/patients/records-types";

export type PractitionerChip = { id: string; name: string; count: number };

/**
 * The Records filter bar: practitioner chips (multi-select), My patients,
 * Show everyone, the name search, the Select toggle for the bulk offer, and
 * the right-hand summary. Filters live in the URL; this only renders them.
 */
export function RecordsFilterBar({
  practitioners,
  selected,
  onToggle,
  mineActive,
  showMine,
  onMine,
  onClear,
  view,
  onClearView,
  search,
  onSearch,
  selectMode,
  onToggleSelect,
  canSelect,
  summary,
}: {
  practitioners: PractitionerChip[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  /** The viewer treats patients, so "My patients" is offered. */
  showMine: boolean;
  mineActive: boolean;
  onMine: () => void;
  onClear: () => void;
  /** A deep-linked list view (Treatments due, No upcoming treatment…) still narrows the list. */
  view: PatientView | null;
  onClearView: () => void;
  search: string;
  onSearch: (value: string) => void;
  selectMode: boolean;
  onToggleSelect: () => void;
  canSelect: boolean;
  summary: string;
}) {
  const anySelected = selected.length > 0 || mineActive;
  return (
    <div
      className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2"
      data-qc="records-filter-bar"
    >
      <span className="text-[12.5px] text-ink-3">Practitioner</span>
      <div
        className="scroll-x-plain flex max-w-full items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-[3px] shadow-inset-hi"
        role="group"
        aria-label="Filter by practitioner"
      >
        {practitioners.map((p) => {
          const lane = staffLane(p.id, p.name);
          const on = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              aria-pressed={on}
              data-qc={`records-prac-${p.id}`}
              className={cn(
                "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full pl-1 pr-2.5 text-[13px] transition-[opacity,background-color,box-shadow] duration-200",
                on
                  ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(47,63,102,0.12),0_0_0_1px_rgba(47,63,102,0.06)]"
                  : "text-ink-2 hover:bg-[rgba(47,63,102,0.06)]",
                anySelected && !on && "opacity-45",
              )}
            >
              <span
                className={cn(
                  "flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9.5px] font-semibold text-accent-foreground",
                  lane.tone.edge,
                )}
                aria-hidden
              >
                {lane.initials}
              </span>
              {lane.short}
              <span className="text-[11.5px] tabular-nums text-ink-3">{p.count}</span>
            </button>
          );
        })}
      </div>
      {showMine ? (
        <button
          type="button"
          onClick={onMine}
          aria-pressed={mineActive}
          data-qc="records-mine"
          className={cn(
            "h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold transition-colors",
            mineActive
              ? "bg-foreground text-background"
              : "border border-edge bg-glass-2 text-ink-2 shadow-inset-hi hover:bg-accent-wash hover:text-foreground",
          )}
        >
          My patients
        </button>
      ) : null}
      {anySelected || view ? (
        <button
          type="button"
          onClick={onClear}
          data-qc="records-show-everyone"
          className="-my-1 inline-flex min-h-7 cursor-pointer items-center py-1 text-[13px] font-semibold text-accent-ink underline underline-offset-[3px] hover:text-foreground"
        >
          Show everyone
        </button>
      ) : null}
      {view ? (
        <span
          className="inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft pl-2.5 pr-1 text-[12px] font-semibold text-accent-ink shadow-inset-hi"
          data-qc={`records-view-${view}`}
        >
          {VIEW_LABEL[view]}
          <button
            type="button"
            onClick={onClearView}
            aria-label={`Clear ${VIEW_LABEL[view]}`}
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-[rgba(47,63,102,0.1)]"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ) : null}

      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
        {canSelect ? (
          <button
            type="button"
            onClick={onToggleSelect}
            aria-pressed={selectMode}
            data-qc="records-select-toggle"
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium shadow-inset-hi transition-colors",
              selectMode
                ? "border-transparent bg-accent-soft text-accent-ink"
                : "border-edge bg-glass-2 text-ink-2 hover:bg-accent-wash hover:text-foreground",
            )}
          >
            <CheckSquare className="h-3.5 w-3.5" aria-hidden />
            Select
          </button>
        ) : null}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="name-search"
            placeholder="Name or reference"
            aria-label="Search by name or reference"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="h-8 w-44 rounded-full pl-8 text-[13px] sm:w-52"
          />
        </div>
        <span className="hidden text-[12.5px] text-ink-2 sm:inline" data-qc="records-summary">
          {summary}
        </span>
      </div>
    </div>
  );
}
