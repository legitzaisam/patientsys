import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Send } from "lucide-react";
import { listTeam, sendStaffAlert } from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Audience = "managers" | "practitioners" | "front_desk" | "all" | "user";

const DEPARTMENTS: { value: Exclude<Audience, "user">; label: string }[] = [
  { value: "managers", label: "Owners & managers" },
  { value: "practitioners", label: "Practitioners" },
  { value: "front_desk", label: "Reception" },
  { value: "all", label: "Everyone" },
];

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  practitioner: "Practitioner",
  front_desk: "Reception",
};

function encodeTarget(audience: Audience, userId?: string) {
  return audience === "user" ? `user:${userId ?? ""}` : `dept:${audience}`;
}

function decodeTarget(value: string): { audience: Audience; userId?: string } {
  if (value.startsWith("user:")) {
    return { audience: "user", userId: value.slice(5) };
  }
  return { audience: value.slice(5) as Exclude<Audience, "user"> };
}

/** Compose an urgent or standard alert to teammates; lands in their notification bell. */
export function StaffAlertDialog({
  children,
  recipientId,
  recipientName,
  open,
  onOpenChange,
  defaultBody = "",
}: {
  children?: ReactNode;
  recipientId?: string;
  recipientName?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  defaultBody?: string;
}) {
  const send = useServerFn(sendStaffAlert);
  const fetchTeam = useServerFn(listTeam);
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const lockedToPerson = Boolean(recipientId);
  const [target, setTarget] = useState(
    recipientId ? encodeTarget("user", recipientId) : encodeTarget("managers"),
  );
  const [body, setBody] = useState(defaultBody);
  const [urgent, setUrgent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setBody(defaultBody);
  }, [isOpen, defaultBody]);

  const { data: team } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam(),
    enabled: isOpen && !lockedToPerson,
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

  function resetCompose() {
    setBody(defaultBody);
    setUrgent(false);
    if (!lockedToPerson) setTarget(encodeTarget("managers"));
  }

  async function submit() {
    if (!body.trim()) {
      toast.error("Write a message");
      return;
    }
    const decoded = lockedToPerson
      ? { audience: "user" as const, userId: recipientId }
      : decodeTarget(target);
    if (decoded.audience === "user" && !decoded.userId) {
      toast.error("Choose who to send this to");
      return;
    }
    setSaving(true);
    try {
      const res = await send({
        data: {
          audience: decoded.audience,
          ...(decoded.audience === "user" ? { recipientId: decoded.userId } : {}),
          body: body.trim(),
          urgent,
        },
      });
      toast.success(`Sent to ${res.sent} ${res.sent === 1 ? "person" : "people"}`);
      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["staff-chat"] });
      resetCompose();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="flex w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-5 shadow-popover sm:rounded-[22px]">
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle>
            {recipientName ? `Message ${recipientName}` : "Alert the team"}
          </DialogTitle>
          <DialogDescription>
            {recipientName
              ? "Delivered instantly to their notification bell."
              : "Choose a department or someone specific — delivered to their notification bell."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          {!lockedToPerson && (
            <div className="field-stack">
              <Label htmlFor="alert-target">Send to</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="alert-target">
                  <SelectValue placeholder="Choose recipients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-2xs font-semibold tracking-[0.02em] text-muted-foreground">
                      Department
                    </SelectLabel>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d.value} value={encodeTarget(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {teammates.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="text-2xs font-semibold tracking-[0.02em] text-muted-foreground">
                          Person
                        </SelectLabel>
                        {teammates.map(
                          (m: {
                            userId: string;
                            fullName: string;
                            email: string;
                            role: string;
                          }) => (
                            <SelectItem key={m.userId} value={encodeTarget("user", m.userId)}>
                              {(m.fullName || m.email || "Teammate") +
                                (ROLE_LABEL[m.role] ? ` · ${ROLE_LABEL[m.role]}` : "")}
                            </SelectItem>
                          ),
                        )}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="field-stack">
            <Label htmlFor="alert-body">Message</Label>
            <Textarea
              id="alert-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Running 15 minutes late — please let my 14:30 patient know…"
            />
          </div>

          <div
            className={cn(
              "flex items-center justify-between rounded-2xl border px-4 py-3",
              urgent ? "border-edge bg-destructive-bg" : "border-edge",
            )}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn("h-4 w-4", urgent ? "text-destructive" : "text-ink-3")} />
              <div>
                <p className="text-sm text-foreground">Mark as urgent</p>
                <p className="text-xs text-muted-foreground">Highlighted in red in their notifications</p>
              </div>
            </div>
            <Switch checked={urgent} onCheckedChange={setUrgent} />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2" data-slot="dialog-footer">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button enterSubmit onClick={submit} disabled={saving}>
            <Send className="mr-1 h-4 w-4" />
            {saving ? "Sending…" : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
