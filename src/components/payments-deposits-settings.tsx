import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { getClinicDetails, updateDepositRules } from "@/lib/clinic.functions";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Rules = { leadDays: string; percent: string };

/**
 * Payments and deposits. The two rules the dashboard and the money model
 * read: how many days before a visit the deposit is due, and what share of
 * the price the deposit is.
 */
export function PaymentsDepositsSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const fetchClinic = useServerFn(getClinicDetails);
  const { data } = useQuery({ queryKey: ["clinic-details"], queryFn: () => fetchClinic() });
  const [form, setForm] = useState<Rules>({ leadDays: "3", percent: "30" });
  const [saved, setSaved] = useState<Rules | null>(null);

  useEffect(() => {
    if (!data) return;
    const c = data as { deposit_lead_days?: number | null; deposit_percent?: number | null };
    const next = {
      leadDays: String(c.deposit_lead_days ?? 3),
      percent: String(c.deposit_percent ?? 30),
    };
    setForm(next);
    setSaved(next);
  }, [data]);

  const save = useMutation({
    mutationFn: useServerFn(updateDepositRules),
    onSuccess: () => {
      setSaved(form);
      queryClient.invalidateQueries({ queryKey: ["clinic-details"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Deposit rules saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leadDays = Number.parseInt(form.leadDays, 10);
  const percent = Number.parseInt(form.percent, 10);
  const valid =
    Number.isInteger(leadDays) &&
    leadDays >= 0 &&
    leadDays <= 30 &&
    Number.isInteger(percent) &&
    percent >= 0 &&
    percent <= 100;
  const dirty =
    saved !== null && (form.leadDays !== saved.leadDays || form.percent !== saved.percent);
  const leaveGuard = useUnsavedChanges(
    canEdit && dirty && !save.isPending,
    "deposit-rules-unsaved",
  );

  return (
    <Card className="space-y-4 p-5" data-qc="deposit-rules">
      {leaveGuard}
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-ink-3" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Payments and deposits</h2>
          <p className="text-xs text-muted-foreground">
            The dashboard chases deposits by these rules, and collected money is counted with them.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field-stack">
          <Label htmlFor="deposit-lead-days" className="text-xs text-muted-foreground">
            Deposit due (days before the appointment)
          </Label>
          <Input
            id="deposit-lead-days"
            type="number"
            inputMode="numeric"
            min={0}
            max={30}
            value={form.leadDays}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, leadDays: e.target.value })}
          />
          <p className="text-2xs text-muted-foreground">
            Unpaid bookings inside this window show as Urgent on the dashboard; further out they sit
            under This week.
          </p>
        </div>
        <div className="field-stack">
          <Label htmlFor="deposit-percent" className="text-xs text-muted-foreground">
            Deposit (% of the treatment price)
          </Label>
          <Input
            id="deposit-percent"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={form.percent}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, percent: e.target.value })}
          />
          <p className="text-2xs text-muted-foreground">
            A booking marked deposit paid counts this share of its price as collected.
          </p>
        </div>
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!valid || !dirty || save.isPending}
            onClick={() =>
              save.mutate({ data: { deposit_lead_days: leadDays, deposit_percent: percent } })
            }
          >
            {save.isPending ? "Saving…" : "Save deposit rules"}
          </Button>
        </div>
      )}
    </Card>
  );
}
