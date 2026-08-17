/** Earnings + performance maths. Server-only: never import from a component. */

export type Period = { from: string; to: string };

export type PractitionerStats = {
  userId: string;
  fullName: string;
  jobTitle: string;
  commissionRate: number;
  earned: number;
  collected: number;
  earnedShare: number;
  collectedShare: number;
  clinicEarnedShare: number;
  clinicCollectedShare: number;
  treatments: number;
  patients: number;
  newPatients: number;
  retention: number;
  averageValue: number;
  appointments: number;
  attended: number;
  noShows: number;
  cancelled: number;
  attendance: number;
  outstanding: number;
};

type TreatmentRow = {
  id: string;
  practitioner_id: string | null;
  patient_id: string;
  name: string;
  price: number | null;
  performed_at: string;
  commission_rate_snapshot: number | null;
};

type AppointmentRow = {
  practitioner_id: string | null;
  price: number | null;
  payment_status: string;
  status?: string;
  starts_at: string;
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Builds per-practitioner figures for a period.
 * `rateFor` is the current rate; each treatment uses the rate stamped on it when recorded.
 */
export function buildStats(
  staff: { userId: string; fullName: string; jobTitle: string; commissionRate: number }[],
  treatments: TreatmentRow[],
  appointments: AppointmentRow[],
  yearTreatments: { practitioner_id: string | null; patient_id: string }[],
  patientFirstSeen: Map<string, string>,
  period: Period,
): PractitionerStats[] {
  return staff.map((s) => {
    const mine = treatments.filter((t) => t.practitioner_id === s.userId);
    const earned = mine.reduce((sum, t) => sum + Number(t.price ?? 0), 0);
    const earnedShare = mine.reduce(
      (sum, t) => sum + (Number(t.price ?? 0) * Number(t.commission_rate_snapshot ?? s.commissionRate)) / 100,
      0,
    );
    const paid = appointments.filter(
      (a) => a.practitioner_id === s.userId && a.payment_status === "paid",
    );
    const collected = paid.reduce((sum, a) => sum + Number(a.price ?? 0), 0);
    const collectedShare = (collected * s.commissionRate) / 100;

    const booked = appointments.filter((a) => a.practitioner_id === s.userId);
    const attended = booked.filter((a) => a.status === "attended").length;
    const noShows = booked.filter((a) => a.status === "no_show").length;
    const cancelled = booked.filter((a) => a.status === "cancelled").length;
    const settled = attended + noShows;
    const outstanding = booked
      .filter((a) => a.payment_status === "unpaid" || a.payment_status === "deposit_paid")
      .reduce((sum, a) => sum + Number(a.price ?? 0), 0);

    const patientIds = new Set(mine.map((t) => t.patient_id));
    const newPatients = [...patientIds].filter((id) => {
      const first = patientFirstSeen.get(id);
      return first !== undefined && first >= period.from && first <= period.to;
    }).length;

    const seen = new Map<string, number>();
    for (const t of yearTreatments) {
      if (t.practitioner_id !== s.userId) continue;
      seen.set(t.patient_id, (seen.get(t.patient_id) ?? 0) + 1);
    }
    const returning = [...seen.values()].filter((n) => n > 1).length;
    const retention = seen.size ? Math.round((returning / seen.size) * 100) : 0;

    return {
      userId: s.userId,
      fullName: s.fullName,
      jobTitle: s.jobTitle,
      commissionRate: s.commissionRate,
      earned: round(earned),
      collected: round(collected),
      earnedShare: round(earnedShare),
      collectedShare: round(collectedShare),
      clinicEarnedShare: round(earned - earnedShare),
      clinicCollectedShare: round(collected - collectedShare),
      treatments: mine.length,
      patients: patientIds.size,
      newPatients,
      retention,
      averageValue: mine.length ? round(earned / mine.length) : 0,
      appointments: booked.length,
      attended,
      noShows,
      cancelled,
      attendance: settled ? Math.round((attended / settled) * 100) : 0,
      outstanding: round(outstanding),
    };
  });
}
export type TrendPoint = {
  key: string;
  label: string;
  earned: number;
  collected: number;
  appointments: number;
  attended: number;
  noShows: number;
  attendance: number;
};

function bucketKey(iso: string, monthly: boolean) {
  const d = new Date(iso);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return monthly ? `${d.getUTCFullYear()}-${m}` : `${d.getUTCFullYear()}-${m}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function bucketLabel(key: string, monthly: boolean) {
  const d = new Date(monthly ? `${key}-01T00:00:00Z` : `${key}T00:00:00Z`);
  return monthly
    ? d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Time-bucketed series for the period, per practitioner plus the clinic total. */
export function buildTrend(
  staff: { userId: string }[],
  treatments: TreatmentRow[],
  appointments: AppointmentRow[],
  period: Period,
): { monthly: boolean; clinic: TrendPoint[]; byPractitioner: Record<string, TrendPoint[]> } {
  const start = new Date(period.from);
  const end = new Date(period.to);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const monthly = days > 62;

  const keys: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), monthly ? 1 : start.getUTCDate()));
  while (cursor.getTime() <= end.getTime()) {
    keys.push(bucketKey(cursor.toISOString(), monthly));
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const series = (owner: string | null): TrendPoint[] => {
    const map = new Map<string, TrendPoint>(
      keys.map((k) => [
        k,
        {
          key: k,
          label: bucketLabel(k, monthly),
          earned: 0,
          collected: 0,
          appointments: 0,
          attended: 0,
          noShows: 0,
          attendance: 0,
        },
      ]),
    );
    for (const t of treatments) {
      if (owner && t.practitioner_id !== owner) continue;
      const p = map.get(bucketKey(t.performed_at, monthly));
      if (p) p.earned = round(p.earned + Number(t.price ?? 0));
    }
    for (const a of appointments) {
      if (owner && a.practitioner_id !== owner) continue;
      const p = map.get(bucketKey(a.starts_at, monthly));
      if (!p) continue;
      p.appointments += 1;
      if (a.status === "attended") p.attended += 1;
      if (a.status === "no_show") p.noShows += 1;
      if (a.payment_status === "paid") p.collected = round(p.collected + Number(a.price ?? 0));
    }
    for (const p of map.values()) {
      const settled = p.attended + p.noShows;
      p.attendance = settled ? Math.round((p.attended / settled) * 100) : 0;
    }
    return keys.map((k) => map.get(k)!);
  };

  const byPractitioner: Record<string, TrendPoint[]> = {};
  for (const s of staff) byPractitioner[s.userId] = series(s.userId);
  return { monthly, clinic: series(null), byPractitioner };
}
