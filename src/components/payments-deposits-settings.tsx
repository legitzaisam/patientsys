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
 * Settings → Rules → Deposits. The two rules the dashboard and the money model
 * read: what share of the price the deposit is, and how many days before a
 * visit it is due.
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
    onSuccess: (result) => {
      // Show what the server stored, so the form never drifts from the database.
      const stored = result as { deposit_lead_days?: number; deposit_percent?: number } | undefined;
      const next = {
        leadDays: String(stored?.deposit_lead_days ?? leadDays),
        percent: String(stored?.deposit_percent ?? percent),
      };
      setForm(next);
      setSaved(next);
      queryClient.invalidateQueries({ queryKey: ["clinic-details"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Deposit rules saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Whole numbers only: a blank box or "3.5" is not a rule the server will take.
  const asWhole = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : Number.NaN);
  const leadDays = asWhole(form.leadDays);
  const percent = asWhole(form.percent);
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

  // A worked example so the two numbers read as one rule, not two settings.
  const examplePrice = 300;
  const exampleDeposit = Number.isInteger(percent)
    ? Math.round((examplePrice * percent) / 100)
    : null;
  const dayWord = (n: number) => (n === 1 ? "day" : "days");

  return (
    <Card className="space-y-5 p-5" data-qc="deposit-rules">
      {leaveGuard}
      <div className="flex items-start gap-2.5">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Deposits</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How much deposit a patient pays to secure a booking, and how long before the appointment
            it must be paid.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field-stack">
          <Label htmlFor="deposit-percent" className="text-xs text-muted-foreground">
            Deposit amount
          </Label>
          <div className="relative">
            <Input
              id="deposit-percent"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={form.percent}
              disabled={!canEdit}
              className="pr-44"
              aria-describedby="deposit-percent-unit deposit-percent-help"
              onChange={(e) => setForm({ ...form, percent: e.target.value })}
            />
            <span
              id="deposit-percent-unit"
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
            >
              % of the treatment price
            </span>
          </div>
          <p id="deposit-percent-help" className="text-2xs text-muted-foreground">
            When a booking is marked{" "}
            <span className="font-medium text-foreground">Deposit paid</span>, this amount counts as
            money collected in your reports.
          </p>
        </div>
        <div className="field-stack">
          <Label htmlFor="deposit-lead-days" className="text-xs text-muted-foreground">
            Deposit due
          </Label>
          <div className="relative">
            <Input
              id="deposit-lead-days"
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              value={form.leadDays}
              disabled={!canEdit}
              className="pr-52"
              aria-describedby="deposit-lead-days-unit deposit-lead-days-help"
              onChange={(e) => setForm({ ...form, leadDays: e.target.value })}
            />
            <span
              id="deposit-lead-days-unit"
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
            >
              days before the appointment
            </span>
          </div>
          <p id="deposit-lead-days-help" className="text-2xs text-muted-foreground">
            Unpaid deposits are flagged <span className="font-medium text-foreground">Urgent</span>{" "}
            on the dashboard once the appointment is this close. Before that, they show under{" "}
            <span className="font-medium text-foreground">This week</span> from 10 days out.
          </p>
        </div>
      </div>

      {valid && exampleDeposit !== null ? (
        <p
          className="rounded-xl bg-accent-wash px-3.5 py-2.5 text-xs text-foreground shadow-[inset_0_0_0_1px_var(--accent-line)]"
          data-qc="deposit-rules-example"
        >
          <span className="font-semibold">Example:</span>{" "}
          {percent === 0
            ? "No deposit is taken, so nothing is chased before appointments."
            : `a £${examplePrice} treatment needs a £${exampleDeposit} deposit, paid at least ${leadDays} ${dayWord(leadDays)} before the appointment.`}
        </p>
      ) : (
        <p className="text-2xs text-destructive" role="alert" data-qc="deposit-rules-error">
          Enter a deposit between 0 and 100%, due 0 to 30 days before the appointment.
        </p>
      )}

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
