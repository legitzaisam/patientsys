import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, ClipboardList, Search } from "lucide-react";
import { listPractitioners, listTreatmentPlans } from "@/lib/clinic.functions";
import { PatientAvatar } from "@/components/patient-avatar";
import { Card } from "@/components/ui/card";
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
};

const COLUMNS: Array<{ phase: BoardPlan["phase"]; label: string; sub: string }> = [
  { phase: "consult", label: "Consultation & prep", sub: "New plans and pre-treatment preparation" },
  { phase: "foundation", label: "Foundation", sub: "Assess, plan and prepare" },
  { phase: "build", label: "Build & support", sub: "Ongoing treatment and clinic support" },
  { phase: "results", label: "Results & review", sub: "Assess results and plan next steps" },
];

function dueLabel(dueDate?: string | null) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T12:00:00`);
  const today = new Date();
  const days = Math.round((due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return due.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Patients → Journey board: every active treatment plan by phase, from the
 * Advanced mockup. Owners, managers and front desk open on the whole clinic; a
 * practitioner opens on "My patients" and can toggle to everyone.
 */
export function JourneyBoard({ identity }: { identity: Identity }) {
  const isPractitionerOnly = !identity.isManager && identity.roles.includes("practitioner");
  // Role default: practitioners start on their own book.
  const [scope, setScope] = useState<"mine" | "all">(isPractitionerOnly ? "mine" : "all");
  const [practitionerId, setPractitionerId] = useState<string>("all");
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [query, setQuery] = useState("");

  const effectivePractitioner = isPractitionerOnly
    ? scope === "mine"
      ? identity.userId
      : undefined
    : practitionerId !== "all"
      ? practitionerId
      : undefined;

  const fetchPlans = useServerFn(listTreatmentPlans);
  const { data: plans } = useQuery({
    queryKey: ["treatment-plans", effectivePractitioner ?? "all", atRiskOnly, query],
    queryFn: () =>
      fetchPlans({
        data: {
          ...(effectivePractitioner ? { practitioner_id: effectivePractitioner } : {}),
          ...(atRiskOnly ? { at_risk_only: true } : {}),
          ...(query.trim() ? { query: query.trim() } : {}),
        },
      }),
  });
  const fetchPractitioners = useServerFn(listPractitioners);
  const { data: practitioners } = useQuery({
    queryKey: ["practitioners"],
    queryFn: () => fetchPractitioners(),
    enabled: !isPractitionerOnly,
  });

  const byPhase = useMemo(() => {
    const rows = (plans ?? []) as BoardPlan[];
    return COLUMNS.map((col) => ({ ...col, plans: rows.filter((p) => p.phase === col.phase) }));
  }, [plans]);
  const atRiskCount = ((plans ?? []) as BoardPlan[]).filter((p) => p.atRisk).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isPractitionerOnly ? (
          <div className="flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi">
            {(
              [
                ["mine", "My patients"],
                ["all", "All patients"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setScope(key)}
                className={`h-7 cursor-pointer rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors ${
                  scope === key
                    ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                    : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <select
            value={practitionerId}
            onChange={(e) => setPractitionerId(e.target.value)}
            aria-label="Filter by practitioner"
            className="h-[34px] rounded-xl border border-edge-2 bg-glass-2 px-3 text-xs shadow-inset-hi"
          >
            <option value="all">All practitioners</option>
            {(practitioners ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setAtRiskOnly(!atRiskOnly)}
          aria-pressed={atRiskOnly}
          className={`inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium shadow-inset-hi transition-colors ${
            atRiskOnly
              ? "border-transparent bg-destructive-bg text-destructive-ink"
              : "border-edge bg-glass-2 text-ink-2 hover:border-accent-line hover:bg-accent-wash hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          At risk only{atRiskCount ? ` (${atRiskCount})` : ""}
        </button>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Patient or plan…"
            aria-label="Search plans"
            className="h-[34px] w-52 rounded-xl border border-edge-2 bg-glass-2 pl-8 pr-3 text-xs shadow-inset-hi placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {byPhase.map((col) => (
          <Card key={col.phase} className="p-3">
            <div className="px-1.5 pb-2 pt-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{col.label}</p>
                <p className="shrink-0 text-2xs tabular-nums text-muted-foreground">{col.plans.length}</p>
              </div>
              <p className="mt-0.5 text-2xs text-muted-foreground">{col.sub}</p>
            </div>
            <ul className="space-y-2">
              {col.plans.map((plan) => {
                const pct = plan.total ? Math.round((plan.done / plan.total) * 100) : 0;
                return (
                  <li key={plan.id}>
                    <Link
                      to="/patients/$id"
                      params={{ id: plan.patientId }}
                      className="glass-item block p-3 transition-colors hover:bg-glass"
                    >
                      <div className="flex items-center gap-2.5">
                        <PatientAvatar patientId={plan.patientId} name={plan.patientName} photoUrl={plan.avatarUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{plan.patientName}</p>
                          <p className="truncate text-2xs text-muted-foreground">{plan.name}</p>
                        </div>
                        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                          {plan.done}/{plan.total}
                        </span>
                      </div>
                      {plan.nextMilestone ? (
                        <p className="mt-2 flex items-center gap-1.5 text-2xs text-ink-2">
                          <ClipboardList className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate">{plan.nextMilestone.title}</span>
                          {plan.nextMilestone.dueDate ? (
                            <span
                              className={cn(
                                "ml-auto flex shrink-0 items-center gap-1 tabular-nums",
                                plan.overdue ? "font-semibold text-destructive-ink" : "text-muted-foreground",
                              )}
                            >
                              <CalendarClock className="h-3 w-3" aria-hidden />
                              {dueLabel(plan.nextMilestone.dueDate)}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-glass-2 shadow-inset-hi">
                          <div className="h-full rounded-full bg-accent-line" style={{ width: `${pct}%` }} />
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-2xs font-semibold shadow-inset-hi ${
                            plan.atRisk ? "bg-destructive-bg text-destructive-ink" : "bg-success-bg text-success-ink"
                          }`}
                        >
                          {plan.atRisk ? (plan.riskReason ?? "At risk") : "On track"}
                        </span>
                      </div>
                      {plan.practitionerName ? (
                        <p className="mt-1.5 truncate text-2xs text-muted-foreground">⚕ {plan.practitionerName}</p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
              {col.plans.length === 0 && (
                <li className="rounded-2xl bg-glass-2 px-3 py-5 text-center text-2xs text-muted-foreground shadow-inset-hi">
                  No plans in this phase.
                </li>
              )}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
