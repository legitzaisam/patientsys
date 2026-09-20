import { Link } from "@tanstack/react-router";
import { PatientAvatar } from "@/components/patient-avatar";
import { Card } from "@/components/ui/card";
import { SOURCE_LABEL, type InsightsListRow } from "@/lib/insights.server";

export function ActionList({
  title,
  subtitle,
  rows,
  empty,
  kind,
}: {
  title: string;
  subtitle: string;
  rows: InsightsListRow[];
  empty: string;
  kind: "waiting" | "consulted";
}) {
  return (
    <Card className="p-5">
      <h2 className="section-title">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      <ul className="mt-3">
        {rows.map((row) => {
          const name = `${row.lastName}, ${row.title ? `${row.title} ` : ""}${row.firstName}`.trim();
          const meta =
            kind === "waiting"
              ? `${row.daysWaiting ?? 0}d waiting · ${SOURCE_LABEL[row.source]}${row.interest ? ` · ${row.interest}` : ""}`
              : `${row.lastConsultAt ? new Date(row.lastConsultAt).toLocaleDateString("en-GB") : "Consulted"} · ${SOURCE_LABEL[row.source]}`;
          return (
            <li key={`${row.patientId ?? row.leadId}-${row.email ?? row.firstName}`}>
              <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[rgba(47,63,102,0.08)]">
                <PatientAvatar
                  patientId={row.patientId ?? row.leadId ?? row.email ?? row.firstName}
                  name={`${row.firstName} ${row.lastName}`}
                  photoUrl={row.avatarUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  {row.patientId ? (
                    <Link
                      to="/patients/$id"
                      params={{ id: row.patientId }}
                      className="truncate text-sm font-medium text-foreground hover:text-accent-ink"
                    >
                      {name}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium text-foreground">{name}</p>
                  )}
                  <p className="truncate text-2xs text-muted-foreground">{meta}</p>
                </div>
                {row.patientId &&
                  (kind === "waiting" ? (
                    <Link
                      to="/schedule"
                      className="shrink-0 rounded-full border border-edge bg-glass-2 px-2.5 py-1 text-[11px] font-medium text-ink-2 shadow-inset-hi hover:border-accent-line hover:bg-accent-wash hover:text-foreground"
                    >
                      Schedule
                    </Link>
                  ) : (
                    <Link
                      to="/patients/$id"
                      params={{ id: row.patientId }}
                      className="shrink-0 rounded-full border border-edge bg-glass-2 px-2.5 py-1 text-[11px] font-medium text-ink-2 shadow-inset-hi hover:border-accent-line hover:bg-accent-wash hover:text-foreground"
                    >
                      Open
                    </Link>
                  ))}
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{empty}</li>}
      </ul>
    </Card>
  );
}
