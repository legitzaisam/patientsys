import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PatientAvatar } from "@/components/patient-avatar";
import { displayName } from "@/lib/format";
import type { RecordsSort, RecordsSortDir } from "@/lib/patients/records-sort";
import { staffLane } from "@/lib/staff-lane";
import { cn } from "@/lib/utils";
import {
  nextTreatmentState,
  PATIENT_TYPE_META,
  relativeAgo,
  typeLine,
  type NextTreatmentState,
} from "@/lib/patients/records-summary";
import { TASK_TYPE_META } from "@/lib/tasks/types";
import { isInactive, type PatientRow } from "@/components/patients/records-types";

/**
 * The Records table: Patient · Last treatment · Next treatment · Tasks. Calm
 * by default (a booked next step reads in normal ink), loud by exception
 * (due inside the rebook window, or overdue). Clicking a row selects it and
 * fills the drawer; the checkbox column only appears in Select mode.
 * Column headers sort the full filtered list (not just this page).
 */
export function RecordsTable({
  rows,
  selectedId,
  onSelect,
  selectMode,
  checked,
  onCheck,
  onCheckAll,
  allChecked,
  totalMatching,
  emptyText,
  now,
  sort,
  dir,
  onSort,
}: {
  rows: PatientRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectMode: boolean;
  checked: Set<string>;
  onCheck: (id: string, on: boolean) => void;
  onCheckAll: (on: boolean) => void;
  allChecked: boolean;
  totalMatching: number;
  emptyText: string;
  now: Date;
  sort: RecordsSort;
  dir: RecordsSortDir;
  onSort: (column: RecordsSort) => void;
}) {
  return (
    <table className="glass-table w-full min-w-[640px] text-sm" data-qc="records-table">
      <thead>
        <tr>
          {selectMode ? (
            <th className="w-[1%] px-3">
              <Checkbox
                aria-label={`Select all ${totalMatching} matching patient${totalMatching === 1 ? "" : "s"}`}
                title={`Select all ${totalMatching} matching`}
                checked={allChecked}
                onCheckedChange={(v) => onCheckAll(Boolean(v))}
                data-qc="select-all-patients"
              />
            </th>
          ) : null}
          <th className="w-[38%]">
            <SortHeader
              label="Patient"
              column="patient"
              active={sort}
              dir={dir}
              onSort={onSort}
              hint="A to Z, or Z to A"
            />
          </th>
          <th className="w-[22%]">
            <SortHeader
              label="Last treatment"
              column="last"
              active={sort}
              dir={dir}
              onSort={onSort}
              hint="Oldest first, or newest first"
            />
          </th>
          <th>
            <SortHeader
              label="Next treatment"
              column="next"
              active={sort}
              dir={dir}
              onSort={onSort}
              hint="Soonest or most overdue first, or furthest first"
            />
          </th>
          <th className="w-[1%] whitespace-nowrap text-right">
            <SortHeader
              label="Tasks"
              column="tasks"
              active={sort}
              dir={dir}
              onSort={onSort}
              hint="Most open tasks first, or fewest first"
              align="right"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const summary = p.summary;
          const inactive = isInactive(p);
          const type = summary?.type ?? "regular";
          const meta = PATIENT_TYPE_META[type];
          const prac = summary?.primaryPractitionerId
            ? staffLane(summary.primaryPractitionerId, summary.primaryPractitionerName)
            : null;
          const next = nextTreatmentState(
            {
              nextAppointment: p.nextAppointment,
              nextDue: p.nextDue,
              planStep: summary?.planStep ?? null,
            },
            now,
          );
          const selected = p.id === selectedId;
          const tasks = summary?.openTasks ?? [];
          const top = tasks[0];
          return (
            <tr
              key={p.id}
              data-selected={selected ? "true" : undefined}
              data-qc="records-row"
              aria-selected={selected}
              onClick={() => onSelect(p.id)}
              className={cn(
                "cursor-pointer transition-colors",
                selected && "bg-accent-wash shadow-[inset_0_0_0_1.5px_var(--accent-line)]",
              )}
            >
              {selectMode ? (
                <td className="w-[1%] px-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label={`Select ${p.first_name} ${p.last_name}`}
                    checked={checked.has(p.id)}
                    onCheckedChange={(v) => onCheck(p.id, Boolean(v))}
                    data-qc="select-patient"
                  />
                </td>
              ) : null}
              <td>
                <div className="flex items-center gap-2.5">
                  <span className={cn("relative shrink-0", inactive && "grayscale-[0.8]")}>
                    <PatientAvatar
                      patientId={p.id}
                      name={`${p.first_name} ${p.last_name}`}
                      photoUrl={p.avatar_url}
                      size="md"
                    />
                    {prac ? (
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold text-accent-foreground ring-2 ring-card",
                          prac.tone.edge,
                        )}
                        title={summary?.primaryPractitionerName ?? undefined}
                        aria-hidden
                      >
                        {prac.initials}
                      </span>
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    {/* The name opens the record (the app's long-standing way in); the row itself selects. */}
                    <Link
                      to="/patients/$id"
                      params={{ id: p.id }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "block truncate text-[14px] font-medium hover:text-accent-ink",
                        inactive ? "text-ink-3" : "text-foreground",
                      )}
                      data-qc="records-name"
                    >
                      {displayName(p, { surnameFirst: true })}
                    </Link>
                    <p
                      className={cn("mt-0.5 flex items-center gap-1.5 text-[11.5px]", meta.ink)}
                      data-qc="records-type"
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
                      {typeLine(type, summary?.plan ?? null, inactive)}
                    </p>
                  </div>
                </div>
              </td>
              <td>
                {p.lastTreatment ? (
                  <>
                    <p className="text-[13px] text-foreground">{p.lastTreatment.name}</p>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      {relativeAgo(p.lastTreatment.performed_at, now)}
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] text-ink-3">No treatments yet</p>
                )}
              </td>
              <td>
                <NextTreatmentCell state={next} />
              </td>
              <td className="text-right">
                {top ? (
                  <TaskPill
                    type={top.type}
                    count={tasks.length}
                    assigneeId={top.assigneeId}
                    assigneeName={top.assigneeName}
                    late={tasks.some((t) => t.late)}
                  />
                ) : null}
              </td>
            </tr>
          );
        })}
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={selectMode ? 5 : 4}
              className="px-4 py-10 text-center text-muted-foreground"
              data-qc="records-empty"
            >
              {emptyText}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function SortHeader({
  label,
  column,
  active,
  dir,
  onSort,
  hint,
  align = "left",
}: {
  label: string;
  column: RecordsSort;
  active: RecordsSort;
  dir: RecordsSortDir;
  onSort: (column: RecordsSort) => void;
  hint: string;
  align?: "left" | "right";
}) {
  const on = active === column;
  const Icon = on && dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      title={hint}
      aria-label={`${label}. ${hint}`}
      aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}
      data-qc={`records-sort-${column}`}
      data-dir={on ? dir : undefined}
      className={cn(
        "inline-flex w-full items-center gap-1 uppercase tracking-[0.05em] transition-colors hover:text-foreground",
        align === "right" && "justify-end",
        on ? "text-foreground" : "text-ink-3",
      )}
    >
      {label}
      <Icon
        className={cn("h-3 w-3 shrink-0", on ? "opacity-80" : "opacity-35")}
        aria-hidden
      />
    </button>
  );
}

const TONE_CLASS: Record<NextTreatmentState["tone"], string> = {
  calm: "text-foreground font-medium",
  loud: "text-accent-ink font-semibold",
  overdue: "text-destructive-ink font-semibold",
  muted: "text-ink-3",
};

function NextTreatmentCell({ state }: { state: NextTreatmentState }) {
  return (
    <span data-qc="next-treatment" data-state={state.kind} data-tone={state.tone} className="block">
      <span className={cn("block text-[13px]", TONE_CLASS[state.tone])}>{state.main}</span>
      <span className="mt-0.5 block text-[12px] text-ink-3">{state.sub}</span>
    </span>
  );
}

function TaskPill({
  type,
  count,
  assigneeId,
  assigneeName,
  late,
}: {
  type: keyof typeof TASK_TYPE_META;
  count: number;
  assigneeId: string | null;
  assigneeName: string | null;
  late: boolean;
}) {
  const meta = TASK_TYPE_META[type];
  const lane = assigneeId ? staffLane(assigneeId, assigneeName) : null;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full pl-0.5 pr-2 text-[11px] font-semibold shadow-inset-hi",
        meta.chip,
      )}
      title={`${count} open task${count === 1 ? "" : "s"} · ${meta.label}${assigneeName ? ` · ${assigneeName}` : ""}`}
      data-qc="open-tasks-pill"
      data-late={late ? "true" : undefined}
    >
      <span
        className={cn(
          "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[7.5px] font-bold text-accent-foreground",
          lane ? lane.tone.edge : "bg-card text-ink-3",
        )}
        aria-hidden
      >
        {lane ? lane.initials : "FD"}
      </span>
      {count}
    </span>
  );
}
