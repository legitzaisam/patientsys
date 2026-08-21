import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Send } from "lucide-react";
import { sendStaffAlert } from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Audience = "managers" | "front_desk" | "all" | "user";

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "managers", label: "Manager" },
  { value: "front_desk", label: "Reception" },
  { value: "all", label: "Everyone" },
];

/** Compose an urgent or standard alert to teammates; lands in their notification bell. */
export function StaffAlertDialog({
  children,
  recipientId,
  recipientName,
  open,
  onOpenChange,
}: {
  children?: ReactNode;
  recipientId?: string;
  recipientName?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const send = useServerFn(sendStaffAlert);
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [audience, setAudience] = useState<Audience>(recipientId ? "user" : "managers");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim() || !body.trim()) {
      toast.error("Add a subject and a message");
      return;
    }
    setSaving(true);
    try {
      const res = await send({
        data: {
          audience,
          ...(recipientId ? { recipientId } : {}),
          title: title.trim(),
          body: body.trim(),
          urgent,
        },
      });
      toast.success(`Sent to ${res.sent} ${res.sent === 1 ? "person" : "people"}`);
      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
      setTitle("");
      setBody("");
      setUrgent(false);
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
      <DialogContent
        dismissOnOverlayClick
        hideDismissHint
        className="flex w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-5 shadow-popover sm:rounded-[22px]"
      >
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle className="text-balance text-[17px] tracking-[-0.016em]">
            {recipientName ? `Message ${recipientName}` : "Alert the team"}
          </DialogTitle>
          <DialogDescription>
            Delivered instantly to the notification bell of whoever you choose.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {!recipientId && (
            <div className="field-stack">
              <Label>Send to</Label>
              <div className="flex flex-wrap gap-2">
                {AUDIENCES.map((a) => (
                  <Button
                    key={a.value}
                    type="button"
                    size="sm"
                    variant={audience === a.value ? "selected" : "outline"}
                    onClick={() => setAudience(a.value)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="field-stack">
            <Label htmlFor="alert-title">Subject</Label>
            <Input
              id="alert-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Running 15 minutes late"
            />
          </div>
          <div className="field-stack">
            <Label htmlFor="alert-body">Message</Label>
            <Textarea
              id="alert-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Please let my 14:30 patient know…"
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

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" className="text-xs" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="text-xs" onClick={submit} disabled={saving}>
            <Send className="mr-1 h-4 w-4" />
            {saving ? "Sending…" : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
