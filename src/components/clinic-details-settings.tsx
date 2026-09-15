import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { getClinicDetails, updateClinicDetails } from "@/lib/clinic.functions";
import { checkEmail, isEmailOk } from "@/lib/email";
import { toastEmailError } from "@/lib/email-toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Clinic = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  reminder_offsets?: number[];
};

/** "168, 24" → [168, 24]; invalid entries dropped, capped at 90 days. */
function parseOffsets(text: string): number[] {
  return [
    ...new Set(
      text
        .split(/[,\s]+/)
        .map((part) => Number.parseInt(part, 10))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 2160),
    ),
  ].sort((a, b) => b - a);
}

export function ClinicDetailsSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const fetchClinic = useServerFn(getClinicDetails);
  const { data } = useQuery({ queryKey: ["clinic-details"], queryFn: () => fetchClinic() });
  const [form, setForm] = useState<Clinic>({ name: "", address: "", phone: "", email: "" });
  const [offsetsText, setOffsetsText] = useState("168, 24");

  useEffect(() => {
    if (data) {
      const c = data as Clinic;
      setForm({
        name: c.name ?? "",
        address: c.address ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
      });
      setOffsetsText((c.reminder_offsets ?? [168, 24]).join(", "));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: useServerFn(updateClinicDetails),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-details"] });
      toast.success("Clinic details saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (
    key: Exclude<keyof Clinic, "reminder_offsets">,
    label: string,
    placeholder: string,
    type = "text",
  ) => (
    <div className="field-stack">
      <Label htmlFor={`clinic-${key}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`clinic-${key}`}
        type={type}
        value={form[key] ?? ""}
        disabled={!canEdit}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-ink-3" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Clinic details</h2>
          <p className="text-xs text-muted-foreground">
            Used on consent forms, receipts and patient messages.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Clinic name", "Aetheria Aesthetics")}
        {field("phone", "Phone", "020 7000 0000", "tel")}
        {field("email", "Email", "hello@clinic.co.uk", "email")}
        {field("address", "Address", "12 Harley Street, London")}
        <div className="field-stack">
          <Label htmlFor="clinic-reminders" className="text-xs text-muted-foreground">
            Appointment reminders (hours before, comma-separated)
          </Label>
          <Input
            id="clinic-reminders"
            value={offsetsText}
            disabled={!canEdit}
            placeholder="168, 24"
            onChange={(e) => setOffsetsText(e.target.value)}
          />
          <p className="text-2xs text-muted-foreground">
            168, 24 sends a reminder a week and a day ahead. Patients who opt out of reminders are
            always skipped.
          </p>
        </div>
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!form.name.trim() || save.isPending || !isEmailOk(form.email ?? "", true)}
            onClick={() => {
              const offsets = parseOffsets(offsetsText);
              if (offsets.length === 0) {
                toast.error("Enter at least one reminder time in hours, e.g. 168, 24");
                return;
              }
              const payload = { ...form, reminder_offsets: offsets };
              if (form.email?.trim()) {
                const check = checkEmail(form.email, "clinic email");
                if (!check.ok) {
                  toastEmailError(check, (suggestion) =>
                    setForm((f) => ({ ...f, email: suggestion })),
                  );
                  return;
                }
                save.mutate({ data: { ...payload, email: check.email } });
                return;
              }
              save.mutate({ data: payload });
            }}
          >
            Save changes
          </Button>
        </div>
      )}
    </Card>
  );
}
