import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertCircle,
  Bell,
  CalendarClock,
  FileSignature,
  MessageCircle,
  PoundSterling,
  UserRoundCog,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AttentionRaw = {
  id: string;
  kind: string;
  urgency: string;
  title: string;
  subtitle?: string;
  patientId?: string;
  appointmentId?: string;
  href?: string;
};

type IssueChip = {
  kind: string;
  label: string;
  className: string;
};

type PersonGroup = {
  key: string;
  name: string;
  href: string;
  chips: IssueChip[];
  subtitle: string;
};

const CHIP_META: Record<string, { label: string; className: string }> = {
  no_show: { label: "No show", className: "bg-destructive-bg text-destructive-ink" },
  consent_due: { label: "Consent due", className: "bg-warning-bg text-consent-ink" },
  payment_due: { label: "Unpaid", className: "bg-destructive-bg text-destructive-ink" },
  balance_due: { label: "Balance due", className: "bg-warning-bg text-warning-ink" },
  treatment_due: { label: "Treatment due", className: "bg-accent-soft text-accent-ink" },
  message: { label: "Message", className: "bg-sky-bg text-sky-ink" },
  incomplete_profile: { label: "Incomplete profile", className: "bg-warning-bg text-warning-ink" },
};

function nameFromTitle(title: string) {
  const idx = title.indexOf(" — ");
  return (idx >= 0 ? title.slice(0, idx) : title).trim() || "Unknown";
}

function treatmentFromSubtitle(subtitle?: string) {
  if (!subtitle) return null;
  // Drop trailing " · HH:MM" time fragments from no-show subtitles
  const cleaned = subtitle.replace(/\s·\s\d{1,2}:\d{2}$/, "").trim();
  return cleaned || null;
}

function groupKey(item: AttentionRaw) {
  if (item.patientId) return `patient:${item.patientId}`;
  if (item.href) return `href:${item.href}`;
  return `id:${item.id}`;
}

function hrefFor(item: AttentionRaw) {
  if (item.href) return item.href;
  if (item.patientId) return `/patients/${item.patientId}`;
  if (item.appointmentId) return `/schedule?day=${new Date().toISOString().slice(0, 10)}`;
  return "/patients";
}

function groupPeople(items: AttentionRaw[]): PersonGroup[] {
  const map = new Map<string, { name: string; href: string; kinds: Set<string>; treatments: string[] }>();

  for (const item of items) {
    const key = groupKey(item);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        name: nameFromTitle(item.title),
        href: hrefFor(item),
        kinds: new Set(),
        treatments: [],
      };
      map.set(key, entry);
    }
    entry.kinds.add(item.kind);
    const treatment = treatmentFromSubtitle(item.subtitle);
    if (treatment && !entry.treatments.includes(treatment)) {
      entry.treatments.push(treatment);
    }
  }

  return [...map.entries()].map(([key, entry]) => ({
    key,
    name: entry.name,
    href: entry.href,
    chips: [...entry.kinds].map((kind) => {
      const meta = CHIP_META[kind] ?? { label: kind.replace(/_/g, " "), className: "bg-glass-2 text-muted-foreground" };
      return { kind, label: meta.label, className: meta.className };
    }),
    subtitle: entry.treatments.join(" · "),
  }));
}

export function AttentionList({ items }: { items: any[] }) {
  const urgent = items.filter((i) => i.urgency === "urgent");
  const thisWeek = items.filter((i) => i.urgency === "this_week");

  return (
    <div className="space-y-6">
      {urgent.length > 0 && <AttentionSection title="Urgent today" items={urgent} tone="urgent" />}
      {thisWeek.length > 0 && <AttentionSection title="This week" items={thisWeek} tone="muted" />}
      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-edge-2 bg-glass-2 p-8 text-center">
          <Bell className="mx-auto h-5 w-5 text-ink-3" />
          <p className="mt-2 text-sm text-muted-foreground">Nothing needs attention right now.</p>
        </div>
      )}
    </div>
  );
}

function AttentionSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: AttentionRaw[];
  tone: "urgent" | "muted";
}) {
  const people = useMemo(() => groupPeople(items), [items]);

  return (
    <div className="glass-card flex max-h-[28rem] flex-col overflow-hidden p-0">
      <div className="sticky top-0 z-[1] flex shrink-0 items-center gap-2 border-b border-glass-line bg-card/95 px-5 py-3.5 backdrop-blur-sm">
        {tone === "urgent" ? (
          <AlertCircle className="h-4 w-4 text-destructive" />
        ) : (
          <Bell className="h-4 w-4 text-ink-3" />
        )}
        <h3 className={`text-sm font-semibold ${tone === "urgent" ? "text-destructive" : "text-foreground"}`}>
          {title}
        </h3>
        <span className="ml-auto rounded-full border border-edge bg-glass-2 px-2 py-0.5 text-2xs font-semibold text-muted-foreground shadow-inset-hi">
          {people.length}
        </span>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {people.map((person) => (
          <AttentionPerson key={person.key} person={person} />
        ))}
      </ul>
    </div>
  );
}

function AttentionPerson({ person }: { person: PersonGroup }) {
  const primaryKind = person.chips[0]?.kind ?? "default";
  const icon = iconFor(primaryKind);

  return (
    <li>
      <Link
        to={person.href as any}
        className="glass-item flex items-start gap-2.5 p-2.5 transition-colors hover:bg-glass"
      >
        <i className={`w-[3px] shrink-0 self-stretch rounded-full ${icon.rail}`} aria-hidden />
        <span className={`mt-0.5 shrink-0 ${icon.tone}`}>
          <icon.Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold leading-snug text-foreground">{person.name}</p>
          {person.subtitle ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{person.subtitle}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {person.chips.map((chip) => (
              <span
                key={chip.kind}
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold shadow-inset-hi",
                  chip.className,
                )}
              >
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </li>
  );
}

function iconFor(kind: string) {
  switch (kind) {
    case "no_show":
      return { Icon: UserX, tone: "text-destructive", rail: "bg-destructive" };
    case "consent_due":
      return { Icon: FileSignature, tone: "text-warning-ink", rail: "bg-consent" };
    case "payment_due":
    case "balance_due":
      return { Icon: PoundSterling, tone: "text-destructive", rail: "bg-destructive" };
    case "treatment_due":
      return { Icon: CalendarClock, tone: "text-accent-ink", rail: "bg-accent" };
    case "message":
      return { Icon: MessageCircle, tone: "text-sky-ink", rail: "bg-sky" };
    case "incomplete_profile":
      return { Icon: UserRoundCog, tone: "text-warning-ink", rail: "bg-warning" };
    default:
      return { Icon: Bell, tone: "text-muted-foreground", rail: "bg-bar" };
  }
}
