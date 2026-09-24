import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { completeConsentInClinic, getAppointmentConsent } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Consent completed in clinic. A patient who arrives without having signed
 * reads the form on the clinic's device, ticks that they have understood it
 * and types their name; the staff member logged in is recorded as the
 * witness. Signing is what moves the patient from "arrived" to "waiting".
 */
export function ConsentInClinicDialog({
  appointmentId,
  open,
  onOpenChange,
  onSigned,
}: {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful signature with the stage the visit is now at. */
  onSigned?: (result: { stage: string | null }) => void;
}) {
  const queryClient = useQueryClient();
  const { data: identity } = useIdentity();
  const fetchConsent = useServerFn(getAppointmentConsent);
  const { data, isLoading } = useQuery({
    queryKey: ["appointment-consent", appointmentId],
    queryFn: () => fetchConsent({ data: { appointment_id: appointmentId! } }),
    enabled: open && Boolean(appointmentId),
  });

  const [understood, setUnderstood] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => {
    if (!open) return;
    setUnderstood(false);
    setName("");
  }, [open, appointmentId]);

  const sign = useMutation({
    mutationFn: useServerFn(completeConsentInClinic),
    onSuccess: (res: any) => {
      const first = data?.patientName?.split(/\s+/)[0] ?? "The patient";
      toast.success(res?.stage === "waiting" ? `Consent signed — ${first} is now waiting` : "Consent signed");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-week"] });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["patient"] });
      void queryClient.invalidateQueries({ queryKey: ["appointment-consent", appointmentId] });
      onSigned?.({ stage: res?.stage ?? null });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const witness =
    typeof identity?.profile?.full_name === "string" ? identity.profile.full_name : (identity?.email ?? "Staff member");
  const alreadySigned = data?.document.status === "signed";
  const expected = data?.patientName ?? "";
  const nameOk = name.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-qc="consent-in-clinic">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent-ink" aria-hidden />
            {alreadySigned ? "Consent on file" : "Complete consent in clinic"}
          </DialogTitle>
          <DialogDescription>
            {data
              ? `${data.patientName} · ${data.treatment}`
              : isLoading
                ? "Loading the consent form…"
                : "The consent form for this appointment."}
          </DialogDescription>
        </DialogHeader>

        {data ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-glass-2 p-4 shadow-inset-hi">
              <p className="text-sm font-semibold text-foreground">{data.document.title}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{data.document.body}</p>
            </div>

            {alreadySigned ? (
              <p className="flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2 text-xs font-medium text-success-ink">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Signed by {data.document.signedName ?? data.patientName}
                {data.document.signedAt
                  ? ` on ${new Date(data.document.signedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                  : ""}
                .
              </p>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Hand the device to {expected.split(/\s+/)[0] || "the patient"} to read the form above. They tick the
                  box and type their full name to sign. You are recorded as the witness.
                </p>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-glass-2 px-3 py-2.5 text-xs leading-relaxed shadow-inset-hi">
                  <Checkbox
                    checked={understood}
                    onCheckedChange={(v) => setUnderstood(v === true)}
                    aria-label="I have read and understood this consent form"
                    data-qc="consent-understood"
                    className="mt-0.5"
                  />
                  <span>
                    I have read and understood this form, my questions have been answered, and I consent to the
                    treatment described.
                  </span>
                </label>
                <div className="space-y-1.5">
                  <Label htmlFor="consent-signed-name" className="text-xs">
                    Patient's full name (signature)
                  </Label>
                  <Input
                    id="consent-signed-name"
                    data-qc="consent-signed-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={expected || "Type your full name"}
                    autoComplete="off"
                    className="font-[Caveat,cursive] text-lg"
                  />
                </div>
                <p className="text-2xs text-muted-foreground">
                  Witnessed by <span className="font-semibold text-foreground">{witness}</span> ·{" "}
                  {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {alreadySigned ? "Close" : "Cancel"}
          </Button>
          {!alreadySigned && data ? (
            <Button
              type="button"
              data-qc="consent-sign"
              disabled={!understood || !nameOk || sign.isPending}
              onClick={() => sign.mutate({ data: { appointment_id: appointmentId!, signed_name: name.trim() } })}
            >
              {sign.isPending ? "Signing…" : "Sign and continue"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
