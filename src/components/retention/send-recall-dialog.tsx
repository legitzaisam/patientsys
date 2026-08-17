import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, MessageSquare, Save, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  sendMessage,
  listMessageTemplates,
  logRetentionOutreach,
  saveMessageTemplate,
} from "@/lib/clinic.functions";

type Channel = "message" | "email" | "sms";

const CHANNEL_CATEGORY: Record<Channel, string> = {
  message: "recall-message",
  email: "recall-email",
  sms: "recall-sms",
};

const VARIABLES = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{full_name}}", label: "Full name" },
  { token: "{{treatment}}", label: "Treatment" },
  { token: "{{due_date}}", label: "Due date" },
  { token: "{{clinic}}", label: "Clinic" },
];

const DEFAULTS: Record<Channel, { subject?: string; body: string }> = {
  message: {
    body:
      "Hi {{first_name}}, we noticed your {{treatment}} is due around {{due_date}}. Would you like to book in? Reply here or give the clinic a call.",
  },
  email: {
    subject: "Time to book your next {{treatment}}",
    body:
      "Hi {{first_name}},\n\nYour {{treatment}} was due on {{due_date}} and we'd love to see you back at {{clinic}}.\n\nReply to this email or call the clinic and we'll find a time that suits you.\n\nKind regards,\n{{clinic}}",
  },
  sms: {
    body:
      "Hi {{first_name}}, your {{treatment}} is due ({{due_date}}). Reply or call {{clinic}} to book. — {{clinic}}",
  },
};

export function SendRecallDialog({
  patientId,
  patientName,
  patientFirstName,
  email,
  phone,
  treatment,
  dueDate,
  clinicName = "the clinic",
}: {
  patientId: string;
  patientName: string;
  patientFirstName?: string;
  email?: string | null;
  phone?: string | null;
  treatment?: string | null;
  dueDate?: string | null;
  clinicName?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("message");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<string>("default");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: templates } = useQuery({
    queryKey: ["message-templates"],
    queryFn: useServerFn(listMessageTemplates),
  });

  const post = useMutation({ mutationFn: useServerFn(sendMessage) });
  const mark = useMutation({ mutationFn: useServerFn(logRetentionOutreach) });
  const saveTemplate = useMutation({
    mutationFn: useServerFn(saveMessageTemplate),
    onSuccess: () => {
      toast.success("Template saved");
      queryClient.invalidateQueries({ queryKey: ["message-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const values = useMemo(() => {
    const first = patientFirstName?.trim() || patientName.split(" ").slice(-1)[0] || "there";
    return {
      "{{first_name}}": first,
      "{{full_name}}": patientName,
      "{{treatment}}": treatment || "your next treatment",
      "{{due_date}}": dueDate ? new Date(dueDate).toLocaleDateString("en-GB") : "soon",
      "{{clinic}}": clinicName,
    } as Record<string, string>;
  }, [patientFirstName, patientName, treatment, dueDate, clinicName]);

  function render(text: string) {
    return text.replace(/\{\{\s*\w+\s*\}\}/g, (m) => values[m.replace(/\s/g, "")] ?? m);
  }

  const channelTemplates = (templates ?? []).filter((t: any) => {
    const c = (t.category ?? "").toLowerCase();
    return c === CHANNEL_CATEGORY[channel] || c === "retention" || c === "recall";
  });

  function applyChannel(next: Channel, id = "default") {
    setChannel(next);
    setTemplateId(id);
    if (id === "default") {
      setSubject(DEFAULTS[next].subject ?? "");
      setBody(DEFAULTS[next].body);
    } else {
      const t = (templates ?? []).find((x: any) => x.id === id);
      setBody(t?.body ?? DEFAULTS[next].body);
      setSubject(DEFAULTS[next].subject ?? "");
    }
  }

  function openDialog() {
    applyChannel("message");
    setOpen(true);
  }

  function insertVariable(token: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => `${b}${token}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function finish(channelLabel: Channel) {
    mark.mutate({ data: { patient_id: patientId, channel: channelLabel } });
    queryClient.invalidateQueries({ queryKey: ["retention"] });
    setOpen(false);
  }

  function submit() {
    const text = render(body);
    if (channel === "message") {
      post.mutate(
        { data: { patient_id: patientId, body: text, as: "staff" } },
        {
          onSuccess: () => {
            toast.success("Recall message sent");
            finish("message");
          },
          onError: (e: Error) => toast.error(e.message),
        },
      );
      return;
    }
    if (channel === "email") {
      if (!email) {
        toast.error("No email address on file for this patient");
        return;
      }
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(render(subject))}&body=${encodeURIComponent(text)}`;
      finish("email");
      return;
    }
    if (!phone) {
      toast.error("No mobile number on file for this patient");
      return;
    }
    window.location.href = `sms:${phone.replace(/\s/g, "")}?&body=${encodeURIComponent(text)}`;
    finish("sms");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          className=""
          onClick={(e) => {
            e.preventDefault();
            openDialog();
          }}
        >
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
          Send recall
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Send recall to {patientName}</DialogTitle>
        </DialogHeader>

        <Tabs value={channel} onValueChange={(v) => applyChannel(v as Channel)}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="message" className="rounded-lg text-xs">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              In-app
            </TabsTrigger>
            <TabsTrigger value="email" className="rounded-lg text-xs">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Email
            </TabsTrigger>
            <TabsTrigger value="sms" className="rounded-lg text-xs">
              <Smartphone className="mr-1.5 h-3.5 w-3.5" />
              SMS
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Template</Label>
          <Select value={templateId} onValueChange={(v) => applyChannel(channel, v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="default">Default recall ({channel})</SelectItem>
              {channelTemplates.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {channel === "email" && (
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl"
              placeholder="Subject line"
            />
          </div>
        )}

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Message</Label>
          <Textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={channel === "sms" ? 4 : 8}
            className="rounded-xl"
            placeholder="Write a recall message…"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertVariable(v.token)}
                className="rounded-full border border-edge bg-glass-2 px-2.5 py-1 text-2xs text-muted-foreground transition hover:bg-glass-2"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-edge bg-glass-2 p-5">
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">Preview</p>
          {channel === "email" && subject && (
            <p className="mt-2 text-sm font-medium">{render(subject)}</p>
          )}
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">{render(body)}</p>
          {channel === "sms" && (
            <p className="mt-3 text-2xs text-muted-foreground">{render(body).length} characters</p>
          )}
        </div>

        {channel === "email" && !email && (
          <p className="text-xs text-destructive">No email address on file for this patient.</p>
        )}
        {channel === "sms" && !phone && (
          <p className="text-xs text-destructive">No mobile number on file for this patient.</p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className=""
            disabled={!body.trim() || saveTemplate.isPending}
            onClick={() => {
              const title = window.prompt("Template name", `Recall (${channel})`);
              if (!title) return;
              saveTemplate.mutate({
                data: { title, body, category: CHANNEL_CATEGORY[channel] },
              });
            }}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save as template
          </Button>
          <Button
            type="button"
            className=""
            disabled={!body.trim() || post.isPending}
            onClick={submit}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {channel === "message" ? "Send recall" : channel === "email" ? "Open email" : "Open SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
