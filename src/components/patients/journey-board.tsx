import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { JOURNEY_PHASES } from "@/lib/journey-phases";
import { listTreatmentPlans } from "@/lib/clinic.functions";
import { PatientAvatar } from "@/components/patient-avatar";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  overdueLabel,
  planDateLabel,
  bookingMismatchLine,
  noShowLine,
} from "@/components/patients/plan-step-copy";
import {
  hitTile,
  isTileKey,
  RISK_DEEP_LINK_TILES,
  RISK_META,
  RISK_ORDER,
  riskUrgency,
  TILE_ORDER,
  tileMatches,
  type DueBucketKey,
  type RiskKey,
  type TileKey,
} from "@/lib/patients/board-risk";
import { staffLane } from "@/lib/staff-lane";
import { cn } from "@/lib/utils";

type Identity = {
  userId: string;
  isManager: boolean;
  roles: string[];
};

type BoardPlan = {
  id: string;
  patientId: string;
  patientName: string;
  patientReference?: string | null;
  avatarUrl?: string | null;
  practitionerId?: string | null;
  practitionerName?: string | null;
  name: string;
  phase: "consult" | "foundation" | "build" | "results";
  done: number;
  total: number;
  nextMilestone: { id: string; title: string; kind: string; dueDate?: string | null } | null;
  overdue: boolean;
  atRisk: boolean;
  riskReason: string | null;
  nextBookingAt?: string | null;
  stepBookedAt?: string | null;
  otherBookingTreatment?: string | null;
  noShowAt?: string | null;
  risk: RiskKey;
  dueBucket: DueBucketKey;
};

const PHASES = JOURNEY_PHASES.map(({ phase, label }) => ({ phase, label }));

/**
 * Patients → Journey board. Information only: triage tiles highlight patients
 * on a practitioner × phase map, and a pill opens that patient in the Records
 * drawer. There are no action buttons here; follow-ups live on the Tasks page.
 * Tiles and the practitioner filter live in the URL (`tiles`, `prac`).
 */
export function JourneyBoard({
  identity,
  initialAtRiskOnly = false,
  tiles: tilesParam,
  prac: pracParam,
}: {
  identity: Identity;
  /** The dashboard's "overdue steps" chip: open on the three "needs a human" tiles. */
  initialAtRiskOnly?: boolean;
  tiles?: string | undefined;
  prac?: string | undefined;
}) {
  const navigate = useNavigate();
  const ownBook = !identity.isManager && identity.roles.includes("practitioner");

  const tiles = useMemo<TileKey[]>(() => {
    if (tilesParam !== undefined) return tilesParam.split(",").filter(isTileKey);
    return initialAtRiskOnly ? [...RISK_DEEP_LINK_TILES] : [];
  }, [tilesParam, initialAtRiskOnly]);
  const prac = useMemo<string[]>(() => {
    if (pracParam === undefined) return ownBook ? [identity.userId] : [];
    if (pracParam === "me") return [identity.userId];
    if (pracParam === "all") return [];
    return pracParam.split(",").filter(Boolean);
  }, [pracParam, ownBook, identity.userId]);

  const go = (patch: { tiles?: TileKey[]; prac?: string[] | "all" }) => {
    const nextTiles = patch.tiles ?? tiles;
    const nextPrac = patch.prac ?? prac;
    const search: Record<string, string> = { tab: "board" };
    if (nextTiles.length) search["tiles"] = nextTiles.join(",");
    else if (tilesParam !== undefined || initialAtRiskOnly) search["tiles"] = "";
    if (nextPrac === "all" || nextPrac.length === 0) {
      if (ownBook) search["prac"] = "all";
    } else search["prac"] = nextPrac.join(",");
    for (const k of Object.keys(search)) if (search[k] === "") delete search[k];
    void navigate({ to: "/patients", search: search as never, replace: true });
  };

  const fetchPlans = useServerFn(listTreatmentPlans);
  const { data } = useQuery({
    queryKey: ["treatment-plans", "board"],
    queryFn: () => fetchPlans({ data: {} }),
  });
  const plans = useMemo(() => (data ?? []) as BoardPlan[], [data]);

  // Rows: every practitioner who holds a plan, busiest first.
  const practitioners = useMemo(() => {
    const map = new Map<string, { id: string; name: string; plans: BoardPlan[] }>();
    for (const p of plans) {
      const id = p.practitionerId ?? "unassigned";
      const row = map.get(id) ?? { id, name: p.practitionerName ?? "Unassigned", plans: [] };
      row.plans.push(p);
      map.set(id, row);
    }
    return [...map.values()].sort(
      (a, b) => b.plans.length - a.plans.length || a.name.localeCompare(b.name),
    );
  }, [plans]);

  const pracOn = (id: string) => prac.length === 0 || prac.includes(id);
  const scoped = plans.filter((p) => pracOn(p.practitionerId ?? "unassigned"));
  const anyTile = tiles.length > 0;
  const highlighted = anyTile ? scoped.filter((p) => hitTile(tiles, p)).length : 0;

  const tileCounts = TILE_ORDER.map((tile) => {
    const matching = scoped
      .filter((p) => tileMatches(tile, p))
      .sort((a, b) => riskUrgency(a) - riskUrgency(b));
    return { tile, count: matching.length, faces: matching.slice(0, 5) };
  });

  return (
    <div data-qc="journey-board">
      {/* Filter row: practitioner faces + the selection summary, Clear on the right. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2" data-qc="board-filter-row">
        <span className="text-[12.5px] text-ink-3">Practitioner</span>
        <div className="flex items-center gap-1.5" role="group" aria-label="Filter by practitioner">
          {practitioners.map((row) => {
            const lane = staffLane(row.id, row.name);
            const on = prac.includes(row.id);
            return (
              <button
                key={row.id}
                type="button"
                aria-pressed={on}
                title={row.name}
                data-qc={`board-prac-${row.id}`}
                onClick={() =>
                  go({ prac: on ? prac.filter((x) => x !== row.id) : [...prac, row.id] })
                }
                className={cn(
                  "flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full text-[11px] font-semibold text-accent-foreground transition-[opacity,box-shadow] duration-200",
                  lane.tone.edge,
                  on
                    ? "shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--foreground)]"
                    : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]",
                  prac.length > 0 && !on && "opacity-45",
                )}
              >
                {lane.initials}
              </button>
            );
          })}
        </div>
        <span className="text-[13px] font-semibold text-foreground" data-qc="board-prac-label">
          {prac.length
            ? practitioners
                .filter((r) => prac.includes(r.id))
                .map((r) => staffLane(r.id, r.name).short)
                .join(", ")
            : "All practitioners"}
        </span>
        <span className="text-[12.5px] text-ink-3">· tap tiles to highlight</span>
        {anyTile || prac.length ? (
          <button
            type="button"
            onClick={() => go({ tiles: [], prac: "all" })}
            data-qc="board-clear"
            className="-my-1 ml-auto inline-flex min-h-7 cursor-pointer items-center py-1 text-[13px] font-semibold text-accent-ink underline underline-offset-[3px] hover:text-foreground"
          >
            {anyTile ? "Clear highlight" : "Clear"}
          </button>
        ) : null}
      </div>

      {/* Triage tiles: toggle, multi-select, OR. */}
      <div
        className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6"
        data-qc="board-tiles"
      >
        {tileCounts.map(({ tile, count, faces }) => {
          const meta = RISK_META[tile];
          const on = tiles.includes(tile);
          return (
            <button
              key={tile}
              type="button"
              aria-pressed={on}
              data-qc={`board-tile-${tile}`}
              data-count={count}
              onClick={() => go({ tiles: on ? tiles.filter((t) => t !== tile) : [...tiles, tile] })}
              className={cn(
                "flex min-h-[112px] cursor-pointer flex-col items-start rounded-2xl p-3.5 text-left transition-[background-color,box-shadow,transform] duration-200",
                on
                  ? cn(
                      meta.fill,
                      "shadow-[0_0_0_2px_var(--tile-ring),0_10px_24px_-12px_var(--tile-ring)]",
                    )
                  : "bg-glass shadow-glass hover:bg-card",
              )}
              style={{ ["--tile-ring" as string]: `var(${meta.ringVar})` }}
            >
              <span
                className={cn("flex items-center gap-1.5 text-[12.5px] font-semibold", meta.ink)}
              >
                <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden />
                {meta.label}
              </span>
              <span className="mt-1 text-[30px] font-semibold leading-none tracking-[-0.01em] text-foreground">
                {count}
              </span>
              <span className="mt-1.5 text-[11.5px] leading-snug text-ink-2">
                {meta.description}
              </span>
              {faces.length ? (
                <span className="mt-auto flex pt-2.5" aria-hidden>
                  {faces.map((p, i) => (
                    <span
                      key={p.id}
                      className={cn("rounded-full ring-2 ring-card", i > 0 && "-ml-1.5")}
                    >
                      <PatientAvatar
                        patientId={p.patientId}
                        name={p.patientName}
                        photoUrl={p.avatarUrl}
                        size={22}
                      />
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Practitioner × phase map. */}
      <Card className="overflow-hidden rounded-[18px] p-0" data-qc="board-map">
        <div className="scroll-x-shadows">
          <TooltipProvider delayDuration={150}>
            <div
              className="grid min-w-[880px] grid-cols-[140px_repeat(4,minmax(0,1fr))]"
              role="table"
              aria-label="Plans by practitioner and phase"
            >
              <div role="row" className="contents">
                <div role="columnheader" className="sticky left-0 z-[1] bg-card px-4 py-3" />
                {PHASES.map((ph, i) => (
                  <div
                    key={ph.phase}
                    role="columnheader"
                    className="flex items-baseline gap-2 border-l border-dashed border-edge-2 px-3 py-3"
                  >
                    <span className="font-mono text-[10px] font-medium text-ink-3">0{i + 1}</span>
                    <span className="text-[12.5px] font-semibold text-foreground">{ph.label}</span>
                  </div>
                ))}
              </div>
              {practitioners.map((row) => {
                const lane = staffLane(row.id, row.name);
                const rowFaded = prac.length > 0 && !prac.includes(row.id);
                return (
                  <div
                    key={row.id}
                    role="row"
                    className={cn(
                      "contents transition-opacity duration-200",
                      rowFaded && "[&>*]:opacity-30",
                    )}
                    data-qc="board-row"
                    data-practitioner={row.id}
                  >
                    <div
                      role="rowheader"
                      className="sticky left-0 z-[1] flex min-h-[132px] items-start gap-2.5 border-t border-edge-2 bg-card px-4 py-4"
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-accent-foreground",
                          lane.tone.edge,
                        )}
                        aria-hidden
                      >
                        {lane.initials}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-foreground">
                          {lane.short || row.name}
                        </span>
                        <span className="block text-[11.5px] text-ink-3">
                          {row.plans.length} plan{row.plans.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </div>
                    {PHASES.map((ph) => {
                      const cell = row.plans
                        .filter((p) => p.phase === ph.phase)
                        .sort((a, b) => riskUrgency(a) - riskUrgency(b));
                      return (
                        <div
                          key={ph.phase}
                          role="cell"
                          className="flex flex-wrap content-start gap-1.5 border-l border-t border-dashed border-edge-2 px-3 py-4"
                        >
                          {cell.map((p) => {
                            const hit = anyTile ? hitTile(tiles, p) : null;
                            const faded = anyTile && !hit;
                            const meta = RISK_META[p.risk];
                            const hitMeta = hit ? RISK_META[hit] : null;
                            return (
                              <Tooltip key={p.id}>
                                <TooltipTrigger asChild>
                                  <Link
                                    to="/patients"
                                    search={{ sel: p.patientId, q: undefined } as never}
                                    data-qc="board-pill"
                                    data-name={p.patientName}
                                    data-patient={p.patientId}
                                    data-risk={p.risk}
                                    data-hit={hit ?? undefined}
                                    className={cn(
                                      "flex h-[26px] items-center gap-1.5 rounded-full pl-[3px] pr-2.5 text-[12px] font-medium text-foreground transition-[opacity,background-color,box-shadow] duration-200",
                                      hitMeta
                                        ? cn(
                                            hitMeta.fill,
                                            "shadow-[0_0_0_1.5px_var(--pill-ring),0_6px_14px_-6px_var(--pill-ring)]",
                                          )
                                        : "bg-[rgba(47,63,102,0.05)] hover:bg-[rgba(47,63,102,0.1)]",
                                      faded && "opacity-30",
                                    )}
                                    style={
                                      hitMeta
                                        ? { ["--pill-ring" as string]: `var(${hitMeta.ringVar})` }
                                        : undefined
                                    }
                                  >
                                    <PatientAvatar
                                      patientId={p.patientId}
                                      name={p.patientName}
                                      photoUrl={p.avatarUrl}
                                      size={20}
                                    />
                                    <span className="max-w-[9rem] truncate">
                                      {p.patientName.split(" ")[0]}
                                    </span>
                                    <span
                                      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)}
                                      aria-hidden
                                    />
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-[12.5px] font-semibold">{p.patientName}</p>
                                  <p className="text-[12px] text-ink-2">
                                    {p.name} · {p.done}/{p.total}
                                  </p>
                                  <p className="text-[12px] text-ink-2">
                                    {p.nextMilestone
                                      ? `Next: ${p.nextMilestone.title}`
                                      : "No next step"}
                                    {(() => {
                                      const late = overdueLabel(p);
                                      const when =
                                        noShowLine(p) ??
                                        bookingMismatchLine(p) ??
                                        late ??
                                        planDateLabel(p);
                                      return when ? ` · ${when}` : "";
                                    })()}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {practitioners.length === 0 ? (
                <div
                  role="row"
                  className="col-span-5 px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No active treatment plans yet.
                </div>
              ) : null}
            </div>
          </TooltipProvider>
        </div>
      </Card>

      {/* Legend and the one note. */}
      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12px] text-ink-2"
        data-qc="board-legend"
      >
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
          {RISK_ORDER.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", RISK_META[k].dot)} aria-hidden />
              {RISK_META[k].label}
            </span>
          ))}
        </div>
        <p className="text-ink-3">
          {anyTile ? `${highlighted} of ${scoped.length} plans highlighted · ` : ""}Hover a patient
          for their plan and next step. Follow-ups live on the Tasks page.
        </p>
      </div>
    </div>
  );
}
