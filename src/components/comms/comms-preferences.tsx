import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveCommsPreferences } from "@/lib/clinic.functions";
import { prefsFromPatient, type CommsPrefs } from "@/lib/comms/preferences";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type Props = {
  patientId: string;
  patient: Partial<CommsPrefs> | null | undefined;
  as?: "staff" | "patient";
  onSaved?: () => void;
};

export function CommsPreferencesCard({ patientId, patient, as = "staff", onSaved }: Props) {
  const prefs = prefsFromPatient(patient);
  const [draft, setDraft] = useState(prefs);
  useEffect(() => {
    setDraft(prefsFromPatient(patient));
  }, [
    patient?.email_opt_in,
    patient?.sms_opt_in,
    patient?.reminders_opt_in,
    patient?.marketing_opt_in,
    patient?.unsubscribed_at,
  ]);

  const save = useMutation({
    mutationFn: useServerFn(saveCommsPreferences),
    onSuccess: () => {
      toast.success("Contact preferences saved");
      onSaved?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = (key: keyof Omit<CommsPrefs, "unsubscribed_at">, value: boolean) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    save.mutate({
      data: {
        patient_id: patientId,
        email_opt_in: next.email_opt_in,
        sms_opt_in: next.sms_opt_in,
        reminders_opt_in: next.reminders_opt_in,
        marketing_opt_in: next.marketing_opt_in,
      },
    });
  };

  return (
    <Card className="p-5">
      <h2 className="section-title">{as === "patient" ? "How we contact you" : "Contact preferences"}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {as === "patient"
          ? "Reminders are on unless you turn them off. Marketing needs you to opt in."
          : "UK marketing is opt-in. Reminders stay on unless the patient opts out. Nothing is emailed or texted from here yet."}
      </p>
      <div className="mt-4 space-y-3">
        <PrefRow
          label="Appointment reminders"
          hint="Visit confirmations and recall reminders by email or text."
          checked={draft.reminders_opt_in}
          disabled={save.isPending}
          onCheckedChange={(value) => set("reminders_opt_in", value)}
        />
        <PrefRow
          label="Marketing"
          hint="Offers and news. Off unless they opt in."
          checked={draft.marketing_opt_in}
          disabled={save.isPending}
          onCheckedChange={(value) => set("marketing_opt_in", value)}
        />
        <PrefRow
          label="Marketing by email"
          hint="Also needs the marketing switch on."
          checked={draft.email_opt_in}
          disabled={save.isPending}
          onCheckedChange={(value) => set("email_opt_in", value)}
        />
        <PrefRow
          label="Marketing by text"
          hint="Also needs the marketing switch on."
          checked={draft.sms_opt_in}
          disabled={save.isPending}
          onCheckedChange={(value) => set("sms_opt_in", value)}
        />
      </div>
    </Card>
  );
}

function PrefRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-edge bg-glass-2 px-4 py-3">
      <div>
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
