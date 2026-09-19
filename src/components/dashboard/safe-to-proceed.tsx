import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PatientAvatar } from "@/components/patient-avatar";
import { Card } from "@/components/ui/card";

export type SafeToProceedItem = {
  id: string;
  patientId: string;
  patientName: string;
  avatarUrl?: string | null;
  treatment: string;
  startsAt: string;
  blockers: string[];
};

function whenLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today ${time}` : `Tomorrow ${time}`;
}

/**
 * Pre-visit review list for today's and tomorrow's bookings, from the Advanced
 * mockup: each row is a patient whose appointment still has a blocker —
 * unsigned consent, unpaid deposit or balance, or an allergy to double-check.
 */
export function SafeToProceed({
  items,
  readyCount,
}: {
  items: SafeToProceedItem[];
  readyCount: number;
}) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 section-title">
          <ShieldCheck className="h-4 w-4 text-accent-ink" aria-hidden />
          Safe to proceed?
        </h2>
        <p className="text-xs text-muted-foreground">
          {items.length
            ? `${items.length} of today's and tomorrow's visits still need a check · ${readyCount} ready`
            : "Pre-treatment checks for today's and tomorrow's visits."}
        </p>
      </div>
      <Card className="p-3">
        {items.length === 0 ? (
          <p className="flex min-h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Every booked visit for today and tomorrow is ready — consents signed, payments settled.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to="/patients/$id"
                  params={{ id: item.patientId }}
                  className="glass-item flex items-start gap-3 p-3"
                >
                  <PatientAvatar
                    patientId={item.patientId}
                    name={item.patientName}
                    photoUrl={item.avatarUrl}
                    size="md"
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{item.patientName}</p>
                      <p className="shrink-0 text-2xs tabular-nums text-muted-foreground">{whenLabel(item.startsAt)}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.treatment}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.blockers.map((blocker) => (
                        <span
                          key={blocker}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold shadow-inset-hi ${
                            blocker.startsWith("Allergy")
                              ? "bg-destructive-bg text-destructive-ink"
                              : "bg-warning-bg text-warning-ink"
                          }`}
                        >
                          {blocker}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
