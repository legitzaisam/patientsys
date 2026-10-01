/**
 * Registration and insurance expiry reminders for the owner's Attention list.
 * Pure: production and demo hand it the staff profile rows.
 */
import { clinicDayDiff } from "@/lib/clinic-time";

/** Attention needed only once a renewal is under 30 clinic days away. */
const ATTENTION_WITHIN_DAYS = 30;

/**
 * Attention rows for registrations and insurance expiring in under 30 days
 * (urgent inside 14 days or once lapsed). Shared by production and demo.
 */
export function complianceReminders(
  staff: {
    id: string;
    full_name?: string | null;
    registration_body?: string | null;
    registration_expiry?: string | null;
    insurance_provider?: string | null;
    insurance_expiry?: string | null;
  }[],
  todayKey: string,
) {
  const items: {
    id: string;
    kind: string;
    urgency: "urgent" | "this_week";
    title: string;
    subtitle: string;
    href: string;
  }[] = [];
  for (const s of staff) {
    const checks: [string, string | null | undefined, string][] = [
      [
        "registration",
        s.registration_expiry,
        s.registration_body ? `${s.registration_body} registration` : "Registration",
      ],
      [
        "insurance",
        s.insurance_expiry,
        s.insurance_provider ? `Insurance (${s.insurance_provider})` : "Insurance",
      ],
    ];
    for (const [key, expiry, label] of checks) {
      if (!expiry) continue;
      const days = clinicDayDiff(todayKey, expiry.slice(0, 10));
      if (days >= ATTENTION_WITHIN_DAYS) continue;
      const when = new Date(`${expiry.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      items.push({
        id: `compliance-${key}-${s.id}`,
        kind: "compliance_due",
        urgency: days <= 14 ? "urgent" : "this_week",
        title: `${s.full_name ?? "Team member"} — ${label} ${days < 0 ? "expired" : "expires"} ${when}`,
        subtitle:
          days < 0
            ? `${Math.abs(days)} days ago · renew before they treat again`
            : `In ${days} day${days === 1 ? "" : "s"} · ask them to renew`,
        href: `/team/${s.id}`,
      });
    }
  }
  return items;
}
