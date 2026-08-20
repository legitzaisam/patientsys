import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getMyRecord, markMessagesRead, signDocument, submitHistoryUpdate } from "@/lib/clinic.functions";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { MessageAttachments } from "@/components/message-attachments";
import { MessageComposer } from "@/components/message-composer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/my-record")({
  head: () => ({
    meta: [
      { title: "My record — Aetheria" },
      { name: "description", content: "View your treatments, sign consent forms, update your health information and message your clinic." },
      { property: "og:title", content: "My record — Aetheria" },
      { property: "og:description", content: "Your treatments, consent forms and clinic messages." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPage,
});

function PortalPage() {
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchRecord = useServerFn(getMyRecord);
  const { data } = useQuery({ queryKey: ["my-record"], queryFn: () => fetchRecord(), enabled: !!identity });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["my-record"] });

  const sign = useMutation({
    mutationFn: useServerFn(signDocument),
    onSuccess: () => {
      toast.success("Signed — thank you");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateHistory = useMutation({
    mutationFn: useServerFn(submitHistoryUpdate),
    onSuccess: () => {
      toast.success("Sent to your practitioner for review");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const markRead = useMutation({
    mutationFn: useServerFn(markMessagesRead),
    onSuccess: () => invalidate(),
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const patientId = data?.patient?.id as string | undefined;

  // Live message thread for this patient.
  useEffect(() => {
    if (!patientId || DEMO_MODE) return;
    const channel = supabase
      .channel(`my-messages-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `patient_id=eq.${patientId}` },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  // Mark staff messages as read when the portal is open.
  useEffect(() => {
    if (!patientId || !data) return;
    const hasUnreadStaff = data.messages.some((m: any) => m.author === "staff" && !m.read_at);
    if (hasUnreadStaff) markRead.mutate({ data: { patient_id: patientId } });
  }, [patientId, data?.messages.length]);

  // Scroll to the latest message when the thread changes.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!data)
    return (
      <AppShell identity={identity}>
        <Card className="p-8">
          <h1 className="text-[19px] font-semibold tracking-[-0.016em] text-foreground">No record linked yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your clinic will link this account to your patient record. Please check back shortly.
          </p>
        </Card>
      </AppShell>
    );

  const p = data.patient as any;

  return (
    <AppShell identity={identity}>
      <div className="mb-6">
        <h1 className="page-title">Hello {p.first_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your treatments, forms and messages with the clinic.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Forms to complete</h2>
            <ul className="mt-3 divide-y divide-glass-line">
              {data.documents.map((d: any) => (
                <li key={d.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-foreground">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.kind.replace("_", " ")}</p>
                    </div>
                    <Badge variant="outline" className="rounded-xl text-2xs uppercase">
                      {d.status}
                    </Badge>
                  </div>
                  {d.body && <p className="mt-2 whitespace-pre-wrap text-xs text-foreground/80">{d.body}</p>}
                  {d.status !== "signed" && (
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget as HTMLFormElement);
                        sign.mutate({ data: { id: d.id, signed_name: String(f.get("signed_name")) } });
                      }}
                    >
                      <Input
                        name="signed_name"
                        placeholder="Type your full name to sign"
                        required
                        className="rounded-xl"
                      />
                      <Button type="submit" className="">
                        Sign
                      </Button>
                    </form>
                  )}
                </li>
              ))}
              {data.documents.length === 0 && (
                <li className="py-6 text-sm text-muted-foreground">Nothing outstanding.</li>
              )}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Update your health information</h2>
            <p className="text-xs text-muted-foreground">
              Tell us about changes to medication, allergies, diet or health so your practitioner can treat you safely.
            </p>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                const f = new FormData(form);
                updateHistory.mutate({
                  data: {
                    medications: String(f.get("medications") ?? ""),
                    allergies: String(f.get("allergies") ?? ""),
                    conditions: String(f.get("conditions") ?? ""),
                    diet: String(f.get("diet") ?? ""),
                    pregnancy: String(f.get("pregnancy") ?? ""),
                    other: String(f.get("other") ?? ""),
                  },
                });
                form.reset();
              }}
            >
              <PField name="medications" label="Medication" defaultValue={p.medications} />
              <PField name="allergies" label="Allergies" defaultValue={p.allergies} />
              <PField name="conditions" label="Medical conditions" defaultValue={p.conditions} />
              <PField name="diet" label="Diet / lifestyle changes" />
              <PField name="pregnancy" label="Pregnancy or breastfeeding" />
              <PField name="other" label="Anything else" />
              <div className="sm:col-span-2">
                <Button type="submit" className="" disabled={updateHistory.isPending}>
                  Send update to my clinic
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">My treatments</h2>
            <ul className="mt-3 divide-y divide-glass-line">
              {data.treatments.map((t: any) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.area}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{new Date(t.performed_at).toLocaleDateString("en-GB")}</p>
                    {t.next_due_at && <p className="text-accent-ink">Due {new Date(t.next_due_at).toLocaleDateString("en-GB")}</p>}
                  </div>
                </li>
              ))}
              {data.treatments.length === 0 && (
                <li className="py-6 text-sm text-muted-foreground">No treatments recorded yet.</li>
              )}
            </ul>
          </Card>
        </div>

        <Card className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl p-0 lg:sticky lg:top-24">
          <div className="border-b border-edge px-5 py-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Message the clinic</h2>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {data.messages.map((m: any) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.author === "patient"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-glass-2 text-foreground"
                }`}
              >
                <p>{m.body}</p>
                <MessageAttachments attachments={(m.attachments ?? []) as any} />
                <div className="mt-1 flex items-center gap-1 text-2xs opacity-70">
                  <span>{new Date(m.created_at).toLocaleString("en-GB")}</span>
                </div>
              </div>
            ))}
            {data.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            <div ref={messagesEndRef} />
          </div>
          <MessageComposer
            patientId={p.id}
            as="patient"
            patientFirstName={p.first_name}
            onSent={invalidate}
          />
        </Card>
      </div>
    </AppShell>
  );
}

function PField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} rows={2} defaultValue={defaultValue ?? ""} className="rounded-xl" />
    </div>
  );
}