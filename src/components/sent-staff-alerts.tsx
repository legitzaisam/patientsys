import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox } from "lucide-react";
import { listSentStaffAlerts } from "@/lib/clinic.functions";
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

/** Toolbar control: recent alerts you sent and who has acknowledged them. */
export function SentStaffAlerts({
  scrolled = false,
  className,
}: {
  scrolled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const sessionReady = useAuthSessionReady();
  const fetchSent = useServerFn(listSentStaffAlerts);
  const { data: rows, isLoading } = useQuery({
    queryKey: ["sent-staff-alerts"],
    queryFn: () => fetchSent(),
    enabled: sessionReady && open,
    refetchInterval: open ? 15_000 : false,
  });

  function openChatWith(recipientId: string) {
    setOpen(false);
    void navigate({
      to: "/team/$id",
      params: { id: recipientId },
      search: { chat: true },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={scrolled ? "outline" : "ghost"}
          size="icon"
          className={cn(
            "relative h-9 w-9",
            className,
            !scrolled && "border border-transparent",
          )}
          aria-label="Sent alerts"
        >
          <Inbox className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90dvh,720px)] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-5 shadow-popover sm:rounded-[22px]">
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle>
            Sent alerts
          </DialogTitle>
          <DialogDescription>
            Who has acknowledged alerts you sent in the last 7 days. Click a row to open chat.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-4 -mr-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-3.5">
          {isLoading && (
            <li className="py-6 text-center text-sm text-muted-foreground">Loading…</li>
          )}
          {!isLoading && (rows?.length ?? 0) === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              No alerts sent in the last week.
            </li>
          )}
          {(rows ?? []).map((row) => {
            const { headline } = parseStaffAlertTitle(row.title);
            return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => openChatWith(row.recipient_id)}
                className="w-full cursor-pointer rounded-2xl border border-edge bg-glass-2 px-3.5 py-3 text-left transition-colors hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] focus-visible:outline-none focus-visible:border-edge-2 focus-visible:bg-[rgba(47,63,102,0.08)] active:bg-[rgba(47,63,102,0.14)]"
                aria-label={`Open chat with ${row.recipient_name}`}
              >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5 text-foreground line-clamp-2">
                    {headline}
                  </p>
                  {row.body ? (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{row.body}</p>
                  ) : null}
                </div>
                {row.read_at ? (
                  <span className="shrink-0 rounded-full bg-success-bg px-2 py-0.5 text-2xs font-semibold text-success-ink">
                    Seen
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-2xs font-semibold text-warning-ink">
                    Waiting
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                To {row.recipient_name}
                {row.urgent ? " · Urgent" : ""}
              </p>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                {row.read_at
                  ? `Acknowledged ${formatWhen(row.read_at)}`
                  : `Sent ${formatWhen(row.created_at)}`}
              </p>
              </button>
            </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
