import { useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Inbox, X } from "lucide-react";
import { DEMO_MODE } from "@/lib/demo/enabled";
import {
  dismissStaffInboxItem,
  listIncomingTeamAlerts,
  listSentStaffAlerts,
  listStaffNotifications,
  markStaffNotificationRead,
} from "@/lib/clinic.functions";
import { useAuthSessionReady } from "@/lib/use-auth-session-ready";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { parseStaffAlertTitle } from "@/lib/staff-alert-title";
import { cn } from "@/lib/utils";

const TEAM_KINDS = new Set(["urgent", "staff_message", "staff_chat"]);

/** ~5 peer stacks visible before scroll. */
const INBOX_LIST_MAX_H = "max-h-[calc(5*6.25rem+4*0.75rem)]";

type InboxRow = {
  id: string;
  direction: "in" | "out";
  title: string;
  body: string | null;
  urgent: boolean;
  kind: string;
  read_at: string | null;
  created_at: string;
  peerId: string | null;
  peerName: string;
};

type PeerGroup = {
  key: string;
  peerId: string | null;
  peerName: string;
  items: InboxRow[];
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function peerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function rowPreview(row: InboxRow) {
  const { headline } = parseStaffAlertTitle(row.title);
  return row.body?.trim() || headline;
}

/** Status / read-receipt chip. Outgoing Seen·Waiting sit on the right of each row. */
function StatusChip({ row }: { row: InboxRow }) {
  const isUrgent = row.urgent || row.kind === "urgent";
  if (row.direction === "in") {
    if (!row.read_at && isUrgent) {
      return (
        <span className="shrink-0 rounded-md bg-destructive-bg px-1.5 py-0.5 text-2xs font-semibold text-destructive-ink">
          Urgent
        </span>
      );
    }
    if (!row.read_at) {
      return (
        <span className="shrink-0 rounded-md bg-sky-bg px-1.5 py-0.5 text-2xs font-semibold text-sky-ink">
          New
        </span>
      );
    }
    return (
      <span className="shrink-0 text-2xs font-medium text-ink-3">Read</span>
    );
  }
  if (!row.read_at && isUrgent) {
    return (
      <span className="shrink-0 rounded-md bg-destructive-bg px-1.5 py-0.5 text-2xs font-semibold text-destructive-ink">
        Urgent
      </span>
    );
  }
  if (!row.read_at) {
    return (
      <span className="shrink-0 rounded-md bg-warning-bg px-1.5 py-0.5 text-2xs font-semibold text-warning-ink">
        Waiting
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-2xs font-medium text-success-ink">
      Seen
    </span>
  );
}

function DismissButton({
  onDismiss,
  dismissing,
}: {
  onDismiss: (e: MouseEvent) => void;
  dismissing: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      disabled={dismissing}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-3/70 transition-colors hover:bg-glass-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      aria-label="Dismiss message"
    >
      <X className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}

function MessageRow({
  row,
  onOpen,
  onDismiss,
  dismissing,
  compact = false,
}: {
  row: InboxRow;
  onOpen: () => void;
  onDismiss: (e: MouseEvent) => void;
  dismissing: boolean;
  compact?: boolean;
}) {
  const unreadIn = row.direction === "in" && !row.read_at;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        disabled={!row.peerId}
        className={cn(
          "w-full cursor-pointer text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70",
          compact
            ? "px-3 py-2.5 pr-10 hover:bg-[rgba(47,63,102,0.06)]"
            : "rounded-2xl border border-edge bg-glass-2 px-3.5 py-3 pr-10 shadow-inset-hi hover:border-edge-2 hover:bg-[rgba(47,63,102,0.06)]",
        )}
        aria-label={`Open chat with ${row.peerName}`}
      >
        <div className="flex items-start gap-2.5">
          {!compact ? (
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(47,63,102,0.1)] text-2xs font-semibold tracking-wide text-ink-2"
              aria-hidden
            >
              {peerInitials(row.peerName)}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink-2">
              {row.direction === "in" ? "From" : "To"} {row.peerName}
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm leading-snug text-foreground line-clamp-2",
                unreadIn ? "font-semibold" : "font-medium",
              )}
            >
              {rowPreview(row)}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-2xs text-muted-foreground">
                {formatWhen(row.created_at)}
                <span className="text-ink-3"> · </span>
                {row.kind === "staff_chat" ? "Chat" : "Alert"}
              </p>
              <div className="ml-auto shrink-0">
                <StatusChip row={row} />
              </div>
            </div>
          </div>
        </div>
      </button>
      <div className="absolute right-1.5 top-1.5">
        <DismissButton onDismiss={onDismiss} dismissing={dismissing} />
      </div>
    </div>
  );
}

function PeerMessageStack({
  group,
  expanded,
  onExpand,
  onCollapse,
  onOpenChat,
  onDismiss,
  dismissingId,
}: {
  group: PeerGroup;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onOpenChat: (row: InboxRow) => void;
  onDismiss: (row: InboxRow, e: MouseEvent) => void;
  dismissingId: string | null;
}) {
  const latest = group.items[0]!;
  const count = group.items.length;
  const hasStack = count > 1;
  const unreadInGroup = group.items.filter((r) => r.direction === "in" && !r.read_at).length;
  const plateCount = Math.min(count - 1, 2);

  if (!hasStack) {
    return (
      <MessageRow
        row={latest}
        onOpen={() => onOpenChat(latest)}
        onDismiss={(e) => onDismiss(latest, e)}
        dismissing={dismissingId === latest.id}
      />
    );
  }

  function toggle() {
    if (expanded) onCollapse();
    else onExpand();
  }

  return (
    <div
      className={cn(
        "relative transition-[padding] duration-300 ease-out",
        !expanded && plateCount > 0 && "pb-[14px]",
      )}
    >
      {/* Silhouette plates — fade out while expanded */}
      {plateCount > 0
        ? Array.from({ length: plateCount }, (_, i) => {
            const depth = plateCount - i;
            return (
              <div
                key={`plate-${depth}`}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute rounded-2xl border border-edge bg-glass-2 transition-opacity duration-300 ease-out",
                )}
                style={{
                  left: depth * 6,
                  right: depth * 6,
                  bottom: (depth - 1) * 7,
                  height: "72%",
                  opacity: expanded ? 0 : 0.55 - (depth - 1) * 0.12,
                  zIndex: 0,
                }}
              />
            );
          })
        : null}

      <div
        className={cn(
          "relative z-[1] overflow-hidden rounded-2xl border border-edge bg-glass-2 shadow-inset-hi transition-colors duration-300",
          expanded && "bg-[rgba(47,63,102,0.04)]",
        )}
      >
        <div className="relative">
          <button
            type="button"
            onClick={toggle}
            disabled={!group.peerId}
            className="w-full cursor-pointer px-3.5 py-3 pr-10 text-left transition-colors hover:bg-[rgba(47,63,102,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Collapse messages with ${group.peerName}`
                : `Expand ${count} messages with ${group.peerName}`
            }
          >
            <div className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(47,63,102,0.1)] text-2xs font-semibold tracking-wide text-ink-2"
                aria-hidden
              >
                {peerInitials(group.peerName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{group.peerName}</p>
                  <span className="shrink-0 rounded-md bg-[rgba(47,63,102,0.08)] px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-ink-2">
                    {count}
                  </span>
                  {unreadInGroup > 0 ? (
                    <span className="shrink-0 rounded-md bg-sky-bg px-1.5 py-0.5 text-2xs font-semibold text-sky-ink">
                      {unreadInGroup} new
                    </span>
                  ) : null}
                </div>
                {!expanded ? (
                  <p
                    className={cn(
                      "mt-0.5 text-sm leading-snug text-foreground line-clamp-2",
                      latest.direction === "in" && !latest.read_at
                        ? "font-semibold"
                        : "font-medium",
                    )}
                  >
                    {rowPreview(latest)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    {count} messages
                    {unreadInGroup > 0 ? ` · ${unreadInGroup} new` : ""}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-2">
                  {!expanded ? (
                    <p className="text-2xs text-muted-foreground">{formatWhen(latest.created_at)}</p>
                  ) : null}
                  {!expanded &&
                  !(
                    unreadInGroup > 0 &&
                    latest.direction === "in" &&
                    !latest.read_at &&
                    !(latest.urgent || latest.kind === "urgent")
                  ) ? (
                    <div className="shrink-0">
                      <StatusChip row={latest} />
                    </div>
                  ) : null}
                  <span className="ml-auto inline-flex items-center gap-0.5 text-2xs font-medium text-ink-3">
                    {expanded ? "Collapse" : "Expand"}
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-300 ease-out",
                        expanded && "rotate-180",
                      )}
                    />
                  </span>
                </div>
              </div>
            </div>
          </button>
          <div className="absolute right-1.5 top-1.5 z-[2]">
            <DismissButton
              onDismiss={(e) => onDismiss(latest, e)}
              dismissing={dismissingId === latest.id}
            />
          </div>
        </div>

        {/* Smooth height expand / collapse */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="divide-y divide-edge/50 border-t border-edge/60">
              {group.items.map((row) => (
                <li key={`${row.direction}-${row.id}`}>
                  <MessageRow
                    row={row}
                    compact
                    onOpen={() => onOpenChat(row)}
                    onDismiss={(e) => onDismiss(row, e)}
                    dismissing={dismissingId === row.id}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Toolbar inbox: team alerts and chat you received or sent. */
export function SentStaffAlerts({
  scrolled = false,
  className,
}: {
  scrolled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [expandedPeers, setExpandedPeers] = useState<Set<string>>(() => new Set());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionReady = useAuthSessionReady();
  const fetchIncoming = useServerFn(listIncomingTeamAlerts);
  const fetchSent = useServerFn(listSentStaffAlerts);
  const fetchUnread = useServerFn(listStaffNotifications);
  const markAlertRead = useServerFn(markStaffNotificationRead);
  const dismissItem = useServerFn(dismissStaffInboxItem);

  const { data: unreadAlerts } = useQuery({
    queryKey: ["staff-notifications"],
    queryFn: () => fetchUnread(),
    refetchInterval: DEMO_MODE ? 4_000 : 60_000,
    enabled: sessionReady,
  });

  const { data: incoming, isLoading: loadingIn } = useQuery({
    queryKey: ["incoming-team-alerts"],
    queryFn: () => fetchIncoming(),
    enabled: sessionReady && open,
    refetchInterval: open ? 15_000 : false,
  });

  const { data: sent, isLoading: loadingOut } = useQuery({
    queryKey: ["sent-staff-alerts"],
    queryFn: () => fetchSent(),
    enabled: sessionReady && open,
    refetchInterval: open ? 15_000 : false,
  });

  const isLoading = loadingIn || loadingOut;
  const unreadCount = (unreadAlerts ?? []).filter((a) => TEAM_KINDS.has(a.kind)).length;

  const groups = useMemo(() => {
    const merged: InboxRow[] = [
      ...((incoming ?? []).map((row) => ({
        id: row.id,
        direction: "in" as const,
        title: row.title,
        body: row.body,
        urgent: !!row.urgent,
        kind: row.kind,
        read_at: row.read_at,
        created_at: row.created_at,
        peerId: row.sender_id,
        peerName: row.sender_name,
      })) ?? []),
      ...((sent ?? []).map((row) => ({
        id: row.id,
        direction: "out" as const,
        title: row.title,
        body: row.body,
        urgent: !!row.urgent,
        kind: row.kind,
        read_at: row.read_at,
        created_at: row.created_at,
        peerId: row.recipient_id,
        peerName: row.recipient_name,
      })) ?? []),
    ];

    const byPeer = new Map<string, PeerGroup>();
    for (const row of merged) {
      const key = row.peerId ?? `unknown:${row.id}`;
      const existing = byPeer.get(key);
      if (existing) {
        existing.items.push(row);
      } else {
        byPeer.set(key, {
          key,
          peerId: row.peerId,
          peerName: row.peerName,
          items: [row],
        });
      }
    }

    const list = [...byPeer.values()];
    for (const group of list) {
      group.items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    list.sort((a, b) => b.items[0]!.created_at.localeCompare(a.items[0]!.created_at));
    return list;
  }, [incoming, sent]);

  function invalidateInbox() {
    void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
  }

  function setDialogOpen(next: boolean) {
    setOpen(next);
    if (!next) setExpandedPeers(new Set());
  }

  function setExpanded(groupKey: string, next: boolean) {
    setExpandedPeers((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(groupKey);
      else copy.delete(groupKey);
      return copy;
    });
  }

  async function openChatWith(row: InboxRow) {
    setDialogOpen(false);
    if (row.direction === "in" && !row.read_at) {
      await markAlertRead({ data: { id: row.id } });
      invalidateInbox();
      void queryClient.invalidateQueries({ queryKey: ["staff-chat"] });
    }
    if (!row.peerId) return;
    void navigate({
      to: "/team/$id",
      params: { id: row.peerId },
      search: { chat: true },
    });
  }

  async function dismissRow(row: InboxRow, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (dismissingId) return;
    setDismissingId(row.id);
    try {
      await dismissItem({ data: { id: row.id } });
      invalidateInbox();
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant={scrolled ? "outline" : "ghost"}
          size="icon"
          className={cn(
            "relative h-9 w-9",
            className,
            !scrolled && "border border-transparent",
          )}
          aria-label={unreadCount ? `Team messages, ${unreadCount} unread` : "Team messages"}
        >
          <Inbox className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90dvh,720px)] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge bg-card/95 p-5 shadow-popover backdrop-blur-glass backdrop-saturate-150 sm:rounded-[22px]">
        <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
          <DialogTitle>Team messages</DialogTitle>
          <DialogDescription>Last 7 days · tap a stack to expand</DialogDescription>
        </DialogHeader>
        <ul
          className={cn(
            "mt-4 -mr-4 min-h-0 shrink space-y-3.5 overflow-y-auto overscroll-contain pr-3.5",
            INBOX_LIST_MAX_H,
          )}
        >
          {isLoading && (
            <li className="py-8 text-center text-sm text-muted-foreground">Loading…</li>
          )}
          {!isLoading && groups.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">
              No team messages this week.
            </li>
          )}
          {groups.map((group) => (
            <li key={group.key}>
              <PeerMessageStack
                group={group}
                expanded={expandedPeers.has(group.key)}
                onExpand={() => setExpanded(group.key, true)}
                onCollapse={() => setExpanded(group.key, false)}
                onOpenChat={(row) => void openChatWith(row)}
                onDismiss={(row, e) => void dismissRow(row, e)}
                dismissingId={dismissingId}
              />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
