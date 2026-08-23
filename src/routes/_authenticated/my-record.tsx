import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyRecord, markMessagesRead, signDocument, submitHistoryUpdate } from "@/lib/clinic.functions";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { PatientChatPanel } from "@/components/patient-chat-panel";
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

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!data)
    return (
      <AppShell identity={identity}>
        <Card className="p-8">
          <h1 className="page-title">No record linked yet</h1>
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
        <p className="page-subtitle">
          Your treatments, forms and messages with the clinic.
        </p>
      </div>

      <div className="relative grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-[26px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="section-title">Forms to complete</h2>
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
                      <Button type="submit">
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
            <h2 className="section-title">Update your health information</h2>
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
                <Button type="submit" disabled={updateHistory.isPending}>
                  Send update to my clinic
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="section-title">My treatments</h2>
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

        <PatientChatPanel
          patientId={p.id}
          patientName={`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Patient"}
          messages={data.messages}
          as="patient"
          title="Your clinic"
          subtitle="Secure messages with your clinic"
          onSent={invalidate}
        />
      </div>
    </AppShell>
  );
}

function PField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  return (
    <div className="field-stack">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} rows={2} defaultValue={defaultValue ?? ""} className="rounded-xl" />
    </div>
  );
}