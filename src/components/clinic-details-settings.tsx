import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { getClinicDetails, updateClinicDetails } from "@/lib/clinic.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Clinic = { name: string; address: string | null; phone: string | null; email: string | null };

export function ClinicDetailsSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const fetchClinic = useServerFn(getClinicDetails);
  const { data } = useQuery({ queryKey: ["clinic-details"], queryFn: () => fetchClinic() });
  const [form, setForm] = useState<Clinic>({ name: "", address: "", phone: "", email: "" });

  useEffect(() => {
    if (data) {
      const c = data as Clinic;
      setForm({ name: c.name ?? "", address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "" });
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

  const field = (key: keyof Clinic, label: string, placeholder: string, type = "text") => (
    <div className="space-y-1.5">
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
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!form.name.trim() || save.isPending}
            onClick={() => save.mutate({ data: form })}
          >
            Save changes
          </Button>
        </div>
      )}
    </Card>
  );
}
