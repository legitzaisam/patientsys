import { Link } from "@tanstack/react-router";
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

export function AttentionList({ items }: { items: any[] }) {
  const urgent = items.filter((i) => i.urgency === "urgent");
  const thisWeek = items.filter((i) => i.urgency === "this_week");

  return (
    <div className="space-y-6">
      {urgent.length > 0 && <AttentionSection title="Urgent today" items={urgent} tone="urgent" />}
      {thisWeek.length > 0 && <AttentionSection title="This week" items={thisWeek} tone="muted" />}
      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-edge bg-glass-2 p-8 text-center">
          <Bell className="mx-auto h-5 w-5 text-muted-foreground" />
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
  items: any[];
  tone: "urgent" | "muted";
}) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4 flex items-center gap-2">
        {tone === "urgent" ? (
          <AlertCircle className="h-4 w-4 text-destructive" />
        ) : (
          <Bell className="h-4 w-4 text-muted-foreground" />
        )}
        <h3 className={`text-sm font-semibold ${tone === "urgent" ? "text-destructive" : "text-foreground"}`}>
          {title}
        </h3>
        <span className="ml-auto rounded-full border border-edge bg-glass-2 px-2 py-0.5 text-2xs font-semibold text-muted-foreground shadow-inset-hi">
          {items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <AttentionItem key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function AttentionItem({ item }: { item: any }) {
  const icon = iconFor(item.kind);
  const href = item.href
    ? item.href
    : item.appointmentId
    ? `/schedule?day=${new Date().toISOString().slice(0, 10)}`
    : `/patients/${item.patientId}`;

  return (
    <li>
      <Link
        to={href as any}
        className="glass-item flex items-start gap-2.5 p-2.5 transition-colors hover:bg-glass"
      >
        <i className={`w-[3px] shrink-0 self-stretch rounded-full ${icon.rail}`} aria-hidden />
        <span className={`mt-0.5 shrink-0 ${icon.tone}`}>
          <icon.Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug text-foreground">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
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
