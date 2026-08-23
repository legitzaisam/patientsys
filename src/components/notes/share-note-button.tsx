import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Send } from "lucide-react";
import { listTeam, sendStaffChatMessage } from "@/lib/clinic.functions";
import { initialsOf } from "@/lib/practitioner-colours";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  practitioner: "Practitioner",
  front_desk: "Reception",
};

const CHAT_BODY_LIMIT = 4000;

function buildShareBody(plain: string) {
  const text = plain.replace(/\u00a0/g, " ").trim();
  if (!text) return null;
  const prefix = "Shared note\n\n";
  const max = CHAT_BODY_LIMIT - prefix.length;
  const clipped = text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
  return prefix + clipped;
}

/** Share the current note into one or more teammates' staff chats (+ inbox ping). */
export function ShareNoteButton({
  getPlainText,
  className,
}: {
  getPlainText: () => string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const fetchTeam = useServerFn(listTeam);
  const sendMessage = useServerFn(sendStaffChatMessage);

  const { data: team, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam(),
    enabled: open,
  });

  const teammates = useMemo(
    () =>
      (team ?? [])
        .filter((m: { isSelf?: boolean }) => !m.isSelf)
        .sort((a: { fullName: string }, b: { fullName: string }) =>
          (a.fullName || "").localeCompare(b.fullName || ""),
        ),
    [team],
  );

  const share = useMutation({
    mutationFn: async (peerIds: string[]) => {
      const body = buildShareBody(getPlainText());
      if (!body) throw new Error("Write something in your notes first");
      for (const peerUserId of peerIds) {
        await sendMessage({ data: { peerUserId, body } });
      }
      return peerIds.length;
    },
    onSuccess: (count) => {
      toast.success(`Shared with ${count} ${count === 1 ? "teammate" : "teammates"}`);
      void queryClient.invalidateQueries({ queryKey: ["staff-chat"] });
      void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
      setSelected(new Set());
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelected(new Set());
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className={className} title="Share note" aria-label="Share note">
          <Send className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90dvh,560px)] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge bg-card/95 p-5 shadow-popover backdrop-blur-glass backdrop-saturate-150 sm:rounded-[22px]">
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle>Share note</DialogTitle>
          <DialogDescription>
            Sends a copy into each person’s Messages chat and notifies them.
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-4 -mr-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-3.5">
          {isLoading && (
            <li className="py-6 text-center text-sm text-muted-foreground">Loading team…</li>
          )}
          {!isLoading && teammates.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">No teammates to share with.</li>
          )}
          {teammates.map((m: { userId: string; fullName: string; role: string; jobTitle?: string }) => {
            const checked = selected.has(m.userId);
            const label = m.fullName || "Teammate";
            const meta = m.jobTitle?.trim() || ROLE_LABEL[m.role] || m.role;
            const initials = initialsOf(label) || "?";
            return (
              <li key={m.userId}>
                <button
                  type="button"
                  onClick={() => toggle(m.userId)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-inset-hi transition-colors focus-visible:outline-none",
                    checked
                      ? "border-accent-line bg-accent-wash"
                      : "border-edge bg-glass-2 hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] focus-visible:border-edge-2 focus-visible:bg-[rgba(47,63,102,0.08)] active:bg-[rgba(47,63,102,0.14)]",
                  )}
                  aria-pressed={checked}
                  aria-label={`${checked ? "Deselect" : "Select"} ${label}`}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold tracking-wide",
                      checked
                        ? "border-accent-line bg-accent-soft text-accent-ink"
                        : "border-edge bg-glass text-ink-3",
                    )}
                  >
                    {initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{label}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{meta}</span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      checked
                        ? "border-accent-line bg-accent text-accent-foreground"
                        : "border-edge-2 bg-glass-2",
                    )}
                    aria-hidden
                  >
                    {checked ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex shrink-0 items-center justify-end gap-2 border-t border-edge pt-4">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={share.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={share.isPending || selected.size === 0}
            onClick={() => share.mutate([...selected])}
            className="rounded-full border border-accent-line bg-accent-soft font-semibold text-accent-ink shadow-inset-hi hover:brightness-[0.97]"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {share.isPending ? "Sending…" : selected.size ? `Send (${selected.size})` : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
