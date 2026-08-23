import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Paperclip, Send, Trash2, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import {
  deleteMessageTemplate,
  listMessageTemplates,
  saveMessageTemplate,
  sendMessage,
  sendStaffChatMessage,
} from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Attachment } from "@/components/message-attachments";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function MessageComposer({
  patientId,
  peerUserId,
  as = "staff",
  onSent,
  templates: withTemplates = false,
  canDeleteTemplates = false,
  patientFirstName,
  placeholder = "Write a message…",
  variant = "default",
  autoFocus = false,
}: {
  /** Patient thread id — required unless messaging a staff peer. */
  patientId?: string;
  /** Staff 1:1 peer — when set, sends via staff chat (with attach + templates). */
  peerUserId?: string;
  as?: "staff" | "patient";
  onSent: () => void;
  templates?: boolean;
  canDeleteTemplates?: boolean;
  patientFirstName?: string;
  placeholder?: string;
  /** `chat` = glass form chrome + outline attach/templates beside the pill. */
  variant?: "default" | "chat";
  autoFocus?: boolean;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newBody, setNewBody] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const isStaffPeer = Boolean(peerUserId);
  const folderKey = peerUserId ? `staff-chat/${peerUserId}` : (patientId ?? "misc");

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus, peerUserId, patientId]);

  const { data: templates } = useQuery({
    queryKey: ["message-templates"],
    queryFn: useServerFn(listMessageTemplates),
    enabled: withTemplates,
  });

  const postPatient = useMutation({
    mutationFn: useServerFn(sendMessage),
    onSuccess: () => {
      setBody("");
      setPending([]);
      onSent();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const postStaff = useMutation({
    mutationFn: useServerFn(sendStaffChatMessage),
    onSuccess: () => {
      setBody("");
      setPending([]);
      onSent();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTemplate = useMutation({
    mutationFn: useServerFn(saveMessageTemplate),
    onSuccess: () => {
      toast.success("Template saved");
      setNewTitle("");
      setNewCategory("");
      setNewBody("");
      queryClient.invalidateQueries({ queryKey: ["message-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTemplate = useMutation({
    mutationFn: useServerFn(deleteMessageTemplate),
    onSuccess: () => {
      toast.success("Template removed");
      queryClient.invalidateQueries({ queryKey: ["message-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sending = isStaffPeer ? postStaff.isPending : postPatient.isPending;

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name} is larger than 10 MB`);
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = DEMO_MODE
          ? URL.createObjectURL(file)
          : `${folderKey}/${crypto.randomUUID()}-${safe}`;
        if (!DEMO_MODE) {
          const { error } = await supabase.storage.from("message-attachments").upload(path, file, {
            contentType: file.type || "application/octet-stream",
          });
          if (error) {
            toast.error(error.message);
            continue;
          }
        }
        uploaded.push({ path, name: file.name, type: file.type, size: file.size });
      }
      setPending((prev) => [...prev, ...uploaded].slice(0, 5));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function applyTemplate(text: string) {
    const filled = text.replace(/\{\{first_name\}\}/g, patientFirstName ?? "there");
    setBody(filled);
    setTemplateOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && pending.length === 0) return;
    if (isStaffPeer && peerUserId) {
      postStaff.mutate({ data: { peerUserId, body, attachments: pending } });
      return;
    }
    if (!patientId) {
      toast.error("Missing conversation");
      return;
    }
    postPatient.mutate({ data: { patient_id: patientId, body, as, attachments: pending } });
  }

  const attachButton = (sizeClass: string) => (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className={cn(sizeClass, "shrink-0")}
      aria-label="Attach file"
      disabled={uploading}
      onClick={() => fileRef.current?.click()}
    >
      <Paperclip className="h-3.5 w-3.5" />
    </Button>
  );

  const templatesButton = (sizeClass: string) =>
    withTemplates ? (
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn(sizeClass, "shrink-0")}
            aria-label="Message templates"
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message templates</DialogTitle>
          </DialogHeader>
          <ul className="divide-y divide-glass-line">
            {(templates ?? []).map((t: any) => (
              <li key={t.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-foreground">{t.title}</p>
                    {t.category && (
                      <p className="text-2xs tracking-[0.02em] text-muted-foreground">{t.category}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{t.body}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" size="sm" onClick={() => applyTemplate(t.body)}>
                      Use
                    </Button>
                    {canDeleteTemplates && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${t.title}`}
                        onClick={() => removeTemplate.mutate({ data: { id: t.id } })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {(templates ?? []).length === 0 && (
              <li className="py-6 text-sm text-muted-foreground">No templates yet.</li>
            )}
          </ul>
          <div className="mt-2 space-y-3 border-t border-edge pt-4">
            <p className="text-sm text-foreground">New template</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field-stack">
                <Label className="text-xs">Title</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="rounded-xl" />
              </div>
              <div className="field-stack">
                <Label className="text-xs">Category</Label>
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="field-stack">
              <Label className="text-xs">Message — use {"{{first_name}}"} to personalise</Label>
              <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={3} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={saveTemplate.isPending}
              onClick={() =>
                saveTemplate.mutate({ data: { title: newTitle, body: newBody, category: newCategory } })
              }
            >
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ) : null;

  const sendButton = (sizeClass: string, iconClass = "h-4 w-4") => (
    <Button
      type="submit"
      size="icon"
      className={cn(sizeClass, "shrink-0 rounded-full")}
      aria-label="Send message"
      disabled={sending || (!body.trim() && pending.length === 0)}
    >
      <Send className={iconClass} />
    </Button>
  );

  return (
    <form
      className={
        variant === "chat"
          ? "shrink-0 space-y-2 border-t border-edge bg-[color-mix(in_srgb,var(--glass)_80%,transparent)] p-2.5 backdrop-blur-md"
          : "space-y-2 border-t border-edge p-3"
      }
      onSubmit={submit}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {pending.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {pending.map((a) => (
            <li
              key={a.path}
              className="inline-flex items-center gap-1 rounded-xl bg-glass-2 px-2 py-1 text-2xs text-foreground"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[140px] truncate">{a.name}</span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => setPending((prev) => prev.filter((p) => p.path !== a.path))}
              >
                <X className="h-3 w-3 opacity-60 hover:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {variant === "chat" ? (
        <div className="flex items-center gap-1">
          <div className="flex min-w-0 flex-1 items-end rounded-[22px] border border-edge bg-glass-2 p-1.5 shadow-inset-hi">
            <Textarea
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={placeholder}
              rows={1}
              className="min-h-9 max-h-28 flex-1 resize-none border-0 bg-transparent px-2.5 py-2 text-sm leading-5 shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(e as unknown as React.FormEvent);
                }
              }}
            />
          </div>
          <div className="flex h-9 shrink-0 items-center gap-0.5 self-center">
            {attachButton("h-7 w-7")}
            {templatesButton("h-7 w-7")}
            {sendButton("h-7 w-7", "h-3.5 w-3.5")}
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          <Textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={placeholder}
            rows={1}
            className="min-h-9 h-9 flex-1 resize-none rounded-xl py-2 text-sm leading-5"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e as unknown as React.FormEvent);
              }
            }}
          />
          <div className="flex items-center gap-1">
            {attachButton("h-9 w-9")}
            {templatesButton("h-9 w-9")}
            {sendButton("h-9 w-9")}
          </div>
        </div>
      )}
    </form>
  );
}
