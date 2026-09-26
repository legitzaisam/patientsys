import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { completeConsentInClinic, getAppointmentConsent } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ConsentContraindications,
  contraindicationsComplete,
  type ContraindicationAnswer,
} from "@/components/consent-contraindications";
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
 * and draws their signature; the staff member logged in is recorded as the
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
  const [signature, setSignature] = useState<string | null>(null);
  const [contraindications, setContraindications] = useState<Record<string, ContraindicationAnswer | undefined>>({});
  useEffect(() => {
    if (!open) return;
    setUnderstood(false);
    setSignature(null);
    setContraindications({});
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
  const drawn = Boolean(signature);
  const questionsDone = contraindicationsComplete(contraindications);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto" data-qc="consent-in-clinic">
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
          <div className="max-h-[min(62dvh,560px)] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-2xl bg-glass-2 p-4 shadow-inset-hi">
              <p className="text-sm font-semibold text-foreground">{data.document.title}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{data.document.body}</p>
            </div>

            {alreadySigned ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2 text-xs font-medium text-success-ink">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Signed by {data.document.signedName ?? data.patientName}
                  {data.document.signedAt
                    ? ` on ${new Date(data.document.signedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                  .
                </p>
                {data.document.signatureData ? (
                  <img
                    src={data.document.signatureData}
                    alt={`Signature of ${data.document.signedName ?? data.patientName}`}
                    className="h-16 w-full rounded-xl border border-edge bg-white object-contain"
                  />
                ) : null}
              </div>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Hand the device to {expected.split(/\s+/)[0] || "the patient"} to answer the questions, tick the box,
                  and draw their signature. You are recorded as the witness.
                </p>
                <ConsentContraindications
                  value={contraindications}
                  onChange={(key, answer) => setContraindications((prev) => ({ ...prev, [key]: answer }))}
                />
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
                <SignaturePad key={`${appointmentId ?? ""}-${open ? "open" : "closed"}`} onChange={setSignature} />
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
              disabled={!understood || !drawn || !questionsDone || sign.isPending}
              onClick={() =>
                sign.mutate({
                  data: {
                    appointment_id: appointmentId!,
                    signed_name: expected.trim() || "Patient",
                    signature_data: signature!,
                    contraindications,
                  },
                })
              }
            >
              {sign.isPending ? "Signing…" : "Sign and continue"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const ink = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function paintStyle(ctx: CanvasRenderingContext2D, ratio: number) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 1.75;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1c1c1c";
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fit = () => {
      if (ink.current) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      paintStyle(ctx, ratio);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);

    const pointFrom = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const move = (event: PointerEvent) => {
      if (!drawing.current) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const next = pointFrom(event);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      ink.current = true;
    };

    const end = () => {
      if (!drawing.current) return;
      drawing.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      onChangeRef.current(ink.current ? canvas.toDataURL("image/png") : null);
    };

    const start = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // The dialog takes pointer capture for itself, so the rest of the stroke
      // is followed on the window rather than on the canvas.
      event.preventDefault();
      drawing.current = true;
      const next = pointFrom(event);
      ctx.beginPath();
      ctx.moveTo(next.x, next.y);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    };

    canvas.addEventListener("pointerdown", start);
    return () => {
      canvas.removeEventListener("pointerdown", start);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      observer.disconnect();
    };
  }, []);

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ink.current = false;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    onChange(null);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-edge px-3 py-1.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">Draw your signature</p>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-accent-ink hover:underline"
          data-qc="consent-signature-clear"
        >
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        data-qc="consent-signature"
        aria-label="Draw your signature"
        className="block h-28 w-full touch-none cursor-crosshair"
      />
    </div>
  );
}
