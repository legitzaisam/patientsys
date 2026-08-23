import { useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, Inbox, X } from "lucide-react";
import { DEMO_MODE } from "@/lib/demo/enabled";
import {
  dismissStaffInboxItem,
  dismissStaffInboxItems,
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

function rowPreview(row: InboxRow) {
  const { headline } = parseStaffAlertTitle(row.title);
  return row.body?.trim() || headline;
}

/** Shared expand/collapse timing — same curve both ways, slightly softer. */
const STACK_MOTION = "duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]";

const CHIP =
  "shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-semibold leading-none";

/** Status / read-receipt chip — always pill background, sits beside dismiss. */
function StatusChip({ row }: { row: InboxRow }) {
  const isUrgent = row.urgent || row.kind === "urgent";
  if (row.direction === "in") {
    if (!row.read_at && isUrgent) {
      return (
        <span className={cn(CHIP, "bg-destructive-bg text-destructive-ink")}>Urgent</span>
      );
    }
    if (!row.read_at) {
      return <span className={cn(CHIP, "bg-sky-bg text-sky-ink")}>New</span>;
    }
    return (
      <span className={cn(CHIP, "text-ink-3")}>Read</span>
    );
  }
  if (!row.read_at && isUrgent) {
    return (
      <span className={cn(CHIP, "bg-destructive-bg text-destructive-ink")}>Urgent</span>
    );
  }
  if (!row.read_at) {
    return (
      <span className={cn(CHIP, "bg-warning-bg text-warning-ink")}>Waiting</span>
    );
  }
  return (
    <span className={cn(CHIP, "bg-success-bg text-success-ink")}>Seen</span>
  );
}

function DismissButton({
  onDismiss,
  dismissing,
  label = "Dismiss message",
}: {
  onDismiss: (e: MouseEvent) => void;
  dismissing: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      disabled={dismissing}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-3/70 transition-colors hover:bg-glass-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      aria-label={label}
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
    <div
      className={cn(
        "group flex items-start gap-1 transition-colors",
        compact
          ? "hover:bg-[rgba(47,63,102,0.06)]"
          : "rounded-2xl border border-edge bg-glass-2 shadow-inset-hi hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)]",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!row.peerId}
        className={cn(
          "min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70",
          compact ? "px-3 py-2.5" : "px-3.5 py-3",
        )}
        aria-label={`Open chat with ${row.peerName}`}
      >
        <div className="min-w-0">
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
          <p className="mt-1 text-2xs text-muted-foreground">
            {formatWhen(row.created_at)}
            <span className="text-ink-3"> · </span>
            {row.kind === "staff_chat" ? "Chat" : "Alert"}
          </p>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-2 pt-1.5 pr-1.5">
        <StatusChip row={row} />
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
  onDismissStack,
  dismissingId,
  dismissingStack,
}: {
  group: PeerGroup;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onOpenChat: (row: InboxRow) => void;
  onDismiss: (row: InboxRow, e: MouseEvent) => void;
  onDismissStack: (e: MouseEvent) => void;
  dismissingId: string | null;
  dismissingStack: boolean;
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
    <div className="relative">
      <div
        className={cn(
          "relative z-[1] overflow-hidden rounded-2xl border border-edge bg-glass-2 shadow-inset-hi transition-colors",
          STACK_MOTION,
          "hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)]",
          expanded && "bg-[rgba(47,63,102,0.04)]",
        )}
      >
        <div
          role="button"
          tabIndex={group.peerId ? 0 : -1}
          onClick={() => {
            if (!group.peerId) return;
            toggle();
          }}
          onKeyDown={(e) => {
            if (!group.peerId) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          aria-expanded={expanded}
          aria-label={
            expanded
              ? `Collapse messages with ${group.peerName}`
              : `Expand ${count} messages with ${group.peerName}`
          }
          className={cn(
            "flex cursor-pointer items-start gap-2 pl-3.5 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            expanded ? "py-2.5" : "pb-3 pt-2.5",
            !group.peerId && "cursor-default",
          )}
        >
          {expanded ? (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                {group.peerName}
              </p>
              <p className="shrink-0 text-2xs text-ink-2">
                {count} {count === 1 ? "Message" : "Messages"}
                {unreadInGroup > 0 ? ` · ${unreadInGroup} New` : ""}
              </p>
              <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-2xs font-medium text-ink-3">
                Collapse
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", STACK_MOTION, "rotate-180")}
                />
              </span>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-5 text-foreground">
                  {group.peerName}
                </p>
                <div
                  className="flex shrink-0 items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <span className="shrink-0 text-2xs font-semibold tabular-nums leading-none text-ink-2">
                    {count} {count === 1 ? "Message" : "Messages"}
                  </span>
                  {unreadInGroup > 0 ? (
                    <span className={cn(CHIP, "bg-sky-bg text-sky-ink")}>
                      {unreadInGroup} New
                    </span>
                  ) : null}
                  <DismissButton
                    onDismiss={onDismissStack}
                    dismissing={dismissingStack}
                    label={`Dismiss all messages with ${group.peerName}`}
                  />
                </div>
              </div>
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
              <div className="mt-1.5 flex items-center gap-2">
                <p className="text-2xs text-muted-foreground">{formatWhen(latest.created_at)}</p>
              </div>
            </div>
          )}
          {expanded ? (
            <div
              className="flex shrink-0 items-center self-center"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <DismissButton
                onDismiss={onDismissStack}
                dismissing={dismissingStack}
                label={`Dismiss all messages with ${group.peerName}`}
              />
            </div>
          ) : null}
        </div>

        {/* Smooth height expand / collapse — same duration + easing both ways */}
        <div
          className={cn(
            "grid transition-[grid-template-rows]",
            STACK_MOTION,
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

      {/* Tight under-stack edges — obvious, not tall; click expands */}
      <div
        className={cn(
          "pointer-events-none relative z-0 transition-opacity",
          STACK_MOTION,
          expanded ? "h-0 opacity-0" : "h-[14px] opacity-100",
          !expanded && group.peerId && "pointer-events-auto cursor-pointer",
        )}
        aria-hidden
        onClick={() => {
          if (!expanded && group.peerId) onExpand();
        }}
      >
        {Array.from({ length: plateCount }, (_, i) => {
          const depth = i + 1;
          return (
            <div
              key={`plate-${depth}`}
              className="absolute left-0 right-0 rounded-b-2xl border border-t-0 border-edge bg-glass-2"
              style={{
                top: depth * 5 - 2,
                left: depth * 8,
                right: depth * 8,
                height: 12,
                opacity: 0.75 - i * 0.2,
                zIndex: -depth,
              }}
            />
          );
        })}
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
  const [dismissingStackKey, setDismissingStackKey] = useState<string | null>(null);
  const [expandedPeers, setExpandedPeers] = useState<Set<string>>(() => new Set());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionReady = useAuthSessionReady();
  const fetchIncoming = useServerFn(listIncomingTeamAlerts);
  const fetchSent = useServerFn(listSentStaffAlerts);
  const fetchUnread = useServerFn(listStaffNotifications);
  const markAlertRead = useServerFn(markStaffNotificationRead);
  const dismissItem = useServerFn(dismissStaffInboxItem);
  const dismissItems = useServerFn(dismissStaffInboxItems);

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
    if (dismissingId || dismissingStackKey) return;
    setDismissingId(row.id);
    try {
      await dismissItem({ data: { id: row.id } });
      invalidateInbox();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not dismiss");
    } finally {
      setDismissingId(null);
    }
  }

  async function dismissStack(group: PeerGroup, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (dismissingId || dismissingStackKey) return;
    setDismissingStackKey(group.key);
    try {
      await dismissItems({ data: { ids: group.items.map((row) => row.id) } });
      setExpandedPeers((prev) => {
        const next = new Set(prev);
        next.delete(group.key);
        return next;
      });
      invalidateInbox();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not dismiss");
    } finally {
      setDismissingStackKey(null);
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
                onDismissStack={(e) => void dismissStack(group, e)}
                dismissingId={dismissingId}
                dismissingStack={dismissingStackKey === group.key}
              />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
