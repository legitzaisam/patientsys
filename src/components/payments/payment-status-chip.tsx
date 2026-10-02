import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { sendPaymentRequest } from "@/lib/clinic.functions";
import { formatMoney } from "@/lib/payment-link";

const CHIP_BASE =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-2xs font-medium tracking-[0.02em] leading-none transition-colors [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0";

/** The appointment fields the chip reads; the diary passes its row, the record a shaped one. */
export type PaymentChipAppointment = {
  id: string;
  patient_id: string;
  starts_at: string;
  treatment_name?: string | null;
  treatment_number?: number | null;
  payment_status: string | null;
  price: number | string | null;
  patients?: { email?: string | null; phone?: string | null } | null;
};

/**
 * The payment chip and its hover card: a receipt once paid, the balance after
 * a deposit, or deposit / full amount to request. Sends go through
 * sendPaymentRequest by email or text. Lived in the diary; the patient
 * record's Ready to treat row reuses it with its own `trigger`.
 */
export function PaymentStatusChip({
  a,
  compact,
  trigger,
  align = "end",
}: {
  a: PaymentChipAppointment;
  compact?: boolean;
  /** Replaces the chip as the hover-card trigger (the record's "Take payment" link). */
  trigger?: ReactNode;
  align?: "start" | "center" | "end";
}) {
  const send = useMutation({
    mutationFn: useServerFn(sendPaymentRequest),
    onError: (e: Error) => toast.error(e.message),
  });
  const [amountKind, setAmountKind] = useState<"deposit" | "full">("deposit");
  const status = (a.payment_status ?? "unpaid") as "unpaid" | "deposit_paid" | "paid" | "refunded";
  const paid = status === "paid";
  const deposit = status === "deposit_paid";
  const email = a.patients?.email ?? undefined;
  const phone = a.patients?.phone ?? undefined;
  const total = Number(a.price ?? 0);
  const depositAmount = Math.round(total * 0.3 * 100) / 100;
  const balance = Math.round((total - depositAmount) * 100) / 100;
  const when = new Date(a.starts_at).toLocaleDateString("en-GB");

  // The server builds the message and queues the real send; a portal copy is
  // written alongside. Refused sends surface as the error toast.
  const dispatch = (
    channel: "email" | "sms",
    kind: "deposit" | "full" | "balance" | "receipt",
    label: string,
  ) => {
    const target = channel === "email" ? email : phone;
    if (!target) {
      toast.error(
        channel === "email" ? "No email on file for this patient" : "No mobile number on file",
      );
      return;
    }
    send.mutate(
      {
        data: {
          patient_id: a.patient_id,
          appointment_id: a.id,
          channel,
          kind,
          app_origin: window.location.origin,
        },
      },
      {
        onSuccess: () =>
          toast.success(`${label} queued to send by ${channel === "email" ? "email" : "text"}`),
      },
    );
  };

  const sendPayment = (channel: "email" | "sms", kind: "deposit" | "full" | "balance") => {
    dispatch(channel, kind, kind === "deposit" ? "Deposit link" : "Payment link");
  };

  const chipClass = `${CHIP_BASE} ${
    paid
      ? "bg-success-bg text-success-ink"
      : deposit
        ? "bg-warning-bg text-warning-ink"
        : "bg-destructive-bg text-destructive"
  }`;
  const chipLabel = compact
    ? paid
      ? "Paid"
      : deposit
        ? "Deposit"
        : status === "refunded"
          ? "Refund"
          : "Unpaid"
    : status.replace("_", " ");
  const chip = (
    <>
      <CreditCard />
      {chipLabel}
    </>
  );

  if (status === "refunded") {
    return (
      <span className={chipClass} title={`Payment: ${status.replace("_", " ")}`}>
        {chip}
      </span>
    );
  }

  const selectedAmount = amountKind === "deposit" ? depositAmount : total;

  return (
    <HoverCard openDelay={80} closeDelay={140}>
      <HoverCardTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className={chipClass}
            title={`Payment: ${status.replace("_", " ")}`}
          >
            {chip}
          </button>
        )}
      </HoverCardTrigger>
      <HoverCardContent className="w-72 rounded-2xl" align={align} data-qc="payment-card">
        <div className="space-y-3 text-xs">
          {paid ? (
            <>
              <p className="text-sm font-semibold text-foreground">Receipt</p>
              <div className="text-muted-foreground">
                <p className="text-foreground">
                  {a.treatment_name} · #{a.treatment_number}
                </p>
                <p>{when}</p>
                <p className="mt-1 font-semibold text-foreground">
                  Paid in full {formatMoney(total)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => dispatch("email", "receipt", "Receipt")}
                >
                  <Mail className="mr-1 h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => dispatch("sms", "receipt", "Receipt")}
                >
                  <Phone className="mr-1 h-3 w-3" /> Text
                </Button>
              </div>
            </>
          ) : deposit ? (
            <>
              <p className="text-sm font-semibold text-foreground">Balance outstanding</p>
              <p className="text-muted-foreground">
                The deposit is in. Send the remaining balance by email or text.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto flex-1 flex-col gap-0.5 py-2 text-xs"
                >
                  <span className="text-2xs font-semibold tracking-[0.02em]">Deposit received</span>
                  <span className="font-semibold tabular-nums">{formatMoney(depositAmount)}</span>
                </Button>
                <Button
                  type="button"
                  variant="selected"
                  className="h-auto flex-1 flex-col gap-0.5 py-2 text-xs"
                >
                  <span className="text-2xs font-semibold tracking-[0.02em]">Balance</span>
                  <span className="font-semibold tabular-nums">{formatMoney(balance)}</span>
                </Button>
              </div>
              <p className="text-2xs text-muted-foreground">
                Sending a balance request for{" "}
                <span className="font-semibold text-foreground">{formatMoney(balance)}</span>. The
                message includes a link to pay in their account.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("email", "balance")}
                >
                  <Mail className="mr-1 h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("sms", "balance")}
                >
                  <Phone className="mr-1 h-3 w-3" /> Text
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Payment outstanding</p>
              <p className="text-muted-foreground">
                Choose deposit or full amount, then send by email or text.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={amountKind === "deposit" ? "selected" : "outline"}
                  onClick={() => setAmountKind("deposit")}
                  className="h-auto flex-1 flex-col gap-0.5 py-2 text-xs"
                >
                  <span className="text-2xs font-semibold tracking-[0.02em]">Deposit</span>
                  <span className="font-semibold tabular-nums">{formatMoney(depositAmount)}</span>
                </Button>
                <Button
                  type="button"
                  variant={amountKind === "full" ? "selected" : "outline"}
                  onClick={() => setAmountKind("full")}
                  className="h-auto flex-1 flex-col gap-0.5 py-2 text-xs"
                >
                  <span className="text-2xs font-semibold tracking-[0.02em]">Full amount</span>
                  <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
                </Button>
              </div>
              <p className="text-2xs text-muted-foreground">
                Sending a {amountKind === "deposit" ? "deposit" : "full payment"} request for{" "}
                <span className="font-semibold text-foreground">{formatMoney(selectedAmount)}</span>
                . The message includes a link to pay in their account.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("email", amountKind)}
                >
                  <Mail className="mr-1 h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("sms", amountKind)}
                >
                  <Phone className="mr-1 h-3 w-3" /> Text
                </Button>
              </div>
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
