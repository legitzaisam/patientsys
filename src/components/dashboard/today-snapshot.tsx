import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  CheckCircle2,
  DoorOpen,
  FileSignature,
  Heart,
  Hourglass,
  Mail,
  Phone,
  Sparkles,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { updateAppointmentState, sendMessage } from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AppointmentTimeEditor } from "@/components/appointment-time-editor";
import { NoShowFollowUpDialog } from "@/components/no-show-followup-dialog";

type Stage = "booked" | "arrived" | "waiting" | "in_treatment" | "aftercare" | "complete" | "no_show";

const STAGES: { key: Stage; label: string; icon: React.ElementType }[] = [
  { key: "booked", label: "Booked", icon: Calendar },
  { key: "arrived", label: "Arrived", icon: DoorOpen },
  { key: "waiting", label: "Waiting", icon: Hourglass },
  { key: "in_treatment", label: "In treatment", icon: Sparkles },
  { key: "aftercare", label: "Aftercare", icon: Heart },
  { key: "complete", label: "Complete", icon: CheckCircle2 },
];

const STAGE_TONE: Record<Stage, string> = {
  booked: "border border-edge bg-glass-2 text-muted-foreground",
  arrived: "bg-sky-bg text-sky-ink",
  waiting: "bg-warning-bg text-warning-ink",
  in_treatment: "bg-accent-soft text-accent-ink",
  aftercare: "bg-destructive-bg text-aftercare-ink",
  complete: "bg-success-bg text-success-ink",
  no_show: "bg-destructive-bg text-destructive-ink",
};

function stageOf(a: any): Stage {
  return (a.stage ?? (a.status === "no_show" ? "no_show" : a.status === "attended" ? "complete" : "booked")) as Stage;
}

export function TodaySnapshot({ appointments, isManager }: { appointments: any[]; isManager: boolean }) {
  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-edge bg-glass-2 p-8 text-center text-sm text-muted-foreground">
        No appointments today.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {appointments.map((a) => (
        <TodayCard key={a.id} appointment={a} isManager={isManager} />
      ))}
    </div>
  );
}

function TodayCard({ appointment: a, isManager }: { appointment: any; isManager: boolean }) {
  const queryClient = useQueryClient();
  const setState = useMutation({
    mutationFn: useServerFn(updateAppointmentState),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const stage = stageOf(a);
  const stageMeta = STAGES.find((s) => s.key === stage) ?? STAGES[0];
  const StageIcon = stage === "no_show" ? UserX : stageMeta!.icon;
  const consentSigned = a.documents?.status === "signed";
  const paymentStatus = a.payment_status as "unpaid" | "deposit_paid" | "paid" | "refunded";

  const setStage = (s: Stage) => setState.mutate({ data: { id: a.id, stage: s } });
  const [noShowOpen, setNoShowOpen] = useState(false);
  const handleStage = (s: Stage) => {
    if (s === "no_show") {
      setNoShowOpen(true);
      return;
    }
    setStage(s);
  };

  return (
    <div className="glass-card p-4 transition-shadow hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div>
          <AppointmentTimeEditor appointment={a}>
            <button
              type="button"
              className="rounded-full text-xs font-medium tabular-nums text-accent-ink underline-offset-4 hover:underline"
            >
              {new Date(a.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              {" – "}
              {new Date(a.ends_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </button>
          </AppointmentTimeEditor>
          <Link
            to="/patients/$id"
            params={{ id: a.patient_id }}
            className="mt-0.5 block text-[15px] font-semibold tracking-[-0.012em] text-foreground hover:text-accent-ink"
          >
            {a.patients?.first_name} {a.patients?.last_name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {a.treatment_name} · #{a.treatment_number}
            {isManager && a.profiles?.full_name && ` · ${a.profiles.full_name}`}
          </p>
        </div>
        <StageBadge stage={stage} StageIcon={StageIcon} onChange={handleStage} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ConsentChip appointment={a} signed={consentSigned} />
        <PaymentChip appointment={a} status={paymentStatus} />
      </div>
      <NoShowFollowUpDialog
        appointment={a}
        open={noShowOpen}
        onOpenChange={setNoShowOpen}
        onMarkNoShow={async () => {
          await setState.mutateAsync({ data: { id: a.id, stage: "no_show" } });
        }}
      />
    </div>
  );
}

function StageBadge({
  stage,
  StageIcon,
  onChange,
}: {
  stage: Stage;
  StageIcon: React.ElementType;
  onChange?: (s: Stage) => void;
}) {
  const label = stage === "no_show" ? "No show" : STAGES.find((s) => s.key === stage)?.label ?? "Booked";
  const trigger = (
    <button
      type="button"
      className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold shadow-inset-hi ${STAGE_TONE[stage]}`}
    >
      <StageIcon className="h-3 w-3" />
      {label}
    </button>
  );

  if (!onChange) return trigger;

  return (
    <HoverCard openDelay={80} closeDelay={140}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent className="w-56 rounded-2xl" align="end">
        <p className="text-sm font-semibold text-foreground">Patient journey</p>
        <p className="text-xs text-muted-foreground">Set current stage.</p>
        <div className="mt-2 space-y-1">
          {STAGES.map((s) => {
            const Icon = s.icon;
            const active = s.key === stage;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onChange(s.key)}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                  active
                    ? "bg-accent-soft font-semibold text-accent-ink"
                    : "text-muted-foreground hover:bg-glass-2 hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" /> {s.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onChange("no_show")}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-destructive-bg ${
              stage === "no_show" ? "bg-destructive-bg font-semibold text-destructive-ink" : "text-destructive-ink"
            }`}
          >
            <UserX className="h-3.5 w-3.5" /> No show
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ConsentChip({ appointment: a, signed }: { appointment: any; signed: boolean }) {
  const send = useMutation({
    mutationFn: useServerFn(sendMessage),
    onError: (e: Error) => toast.error(e.message),
  });
  const name = `${a.patients?.first_name ?? ""}`.trim() || "there";
  const email = a.patients?.email as string | undefined;
  const phone = a.patients?.phone as string | undefined;

  const sendReminder = (channel: "email" | "sms") => {
    const target = channel === "email" ? email : phone;
    if (!target) {
      toast.error(channel === "email" ? "No email on file" : "No mobile number on file");
      return;
    }
    send.mutate(
      {
        data: {
          patient_id: a.patient_id,
          as: "staff" as const,
          body: `Hi ${name}, before your ${a.treatment_name} on ${new Date(
            a.starts_at,
          ).toLocaleDateString("en-GB")}, please complete and sign your consent form. You can open and sign it securely from your patient portal.`,
        },
      },
      { onSuccess: () => toast.success(`Consent reminder sent to ${target}`) },
    );
  };

  const chip = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold shadow-inset-hi ${
        signed ? "bg-success-bg text-success-ink" : "bg-warning-bg text-consent-ink"
      }`}
    >
      <FileSignature className="h-3 w-3" />
      {signed ? "Consent ✓" : "Consent due"}
    </span>
  );

  if (signed) return chip;

  return (
    <HoverCard openDelay={80} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button type="button">{chip}</button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 rounded-2xl" align="start">
        <p className="text-sm font-semibold text-foreground">Consent outstanding</p>
        <p className="mt-1 text-xs text-muted-foreground">Send a reminder to complete the consent form.</p>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-xs"
            disabled={send.isPending}
            onClick={() => sendReminder("email")}
          >
            <Mail className="mr-1 h-3 w-3" /> Email
          </Button>
          <Button
            variant="outline"
            className="flex-1 text-xs"
            disabled={send.isPending}
            onClick={() => sendReminder("sms")}
          >
            <Phone className="mr-1 h-3 w-3" /> Text
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function PaymentChip({ appointment: a, status }: { appointment: any; status: string }) {
  const send = useMutation({
    mutationFn: useServerFn(sendMessage),
    onError: (e: Error) => toast.error(e.message),
  });
  const name = `${a.patients?.first_name ?? ""}`.trim() || "there";
  const email = a.patients?.email as string | undefined;
  const phone = a.patients?.phone as string | undefined;
  const total = Number(a.price ?? 0);
  const depositAmount = Math.round(total * 0.3 * 100) / 100;
  const balance = Math.round((total - depositAmount) * 100) / 100;
  const money = (n: number) => `£${n.toFixed(2)}`;
  const when = new Date(a.starts_at).toLocaleDateString("en-GB");

  const dispatch = (channel: "email" | "sms", body: string, label: string) => {
    const target = channel === "email" ? email : phone;
    if (!target) {
      toast.error(channel === "email" ? "No email on file" : "No mobile number on file");
      return;
    }
    send.mutate(
      { data: { patient_id: a.patient_id, as: "staff" as const, body } },
      { onSuccess: () => toast.success(`${label} sent to ${target}`) },
    );
  };

  const paymentLink = (amount: number, kind: string) =>
    `Hi ${name}, here is your secure ${kind} payment link for ${a.treatment_name} on ${when}: ${money(
      amount,
    )}. You can pay from your patient portal. Thank you.`;

  const receiptBody = `Hi ${name}, here is your receipt for ${a.treatment_name} on ${when}. Amount paid: ${money(
    total,
  )}. A copy is also available in your patient portal.`;

  const paid = status === "paid";
  const deposit = status === "deposit_paid";

  const chip = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold capitalize shadow-inset-hi ${
        paid
          ? "bg-success-bg text-success-ink"
          : deposit
            ? "bg-warning-bg text-warning-ink"
            : "bg-destructive-bg text-destructive-ink"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );

  if (status === "refunded") return chip;

  return (
    <HoverCard openDelay={80} closeDelay={140}>
      <HoverCardTrigger asChild>
        <button type="button">{chip}</button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 rounded-2xl" align="end">
        <div className="space-y-3 text-xs">
          {paid ? (
            <>
              <p className="text-sm font-semibold text-foreground">Receipt</p>
              <div className="glass-item p-2.5 text-muted-foreground">
                <p className="text-foreground">{a.treatment_name}</p>
                <p>{when}</p>
                <p className="mt-1 font-semibold text-foreground">Paid in full {money(total)}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => dispatch("email", receiptBody, "Receipt")}
                >
                  <Mail className="mr-1 h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => dispatch("sms", receiptBody, "Receipt")}
                >
                  <Phone className="mr-1 h-3 w-3" /> Text
                </Button>
              </div>
            </>
          ) : deposit ? (
            <>
              <p className="text-sm font-semibold text-foreground">Balance outstanding</p>
              <p className="text-muted-foreground">
                Deposit {money(depositAmount)} received. Send a link for the remaining{" "}
                <span className="font-semibold text-foreground">{money(balance)}</span>.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => dispatch("email", paymentLink(balance, "balance"), "Payment link")}
                >
                  <Mail className="mr-1 h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => dispatch("sms", paymentLink(balance, "balance"), "Payment link")}
                >
                  <Phone className="mr-1 h-3 w-3" /> Text
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Payment outstanding</p>
              <p className="text-muted-foreground">
                Send a payment link for {money(total)} or a {money(depositAmount)} deposit.
              </p>
              <div className="space-y-2">
                <p className="text-2xs tracking-[0.02em] text-muted-foreground">Full {money(total)}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs"
                    disabled={send.isPending}
                    onClick={() => dispatch("email", paymentLink(total, "full"), "Payment link")}
                  >
                    <Mail className="mr-1 h-3 w-3" /> Email
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-xs"
                    disabled={send.isPending}
                    onClick={() => dispatch("sms", paymentLink(total, "full"), "Payment link")}
                  >
                    <Phone className="mr-1 h-3 w-3" /> Text
                  </Button>
                </div>
                <p className="text-2xs tracking-[0.02em] text-muted-foreground">Deposit {money(depositAmount)}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs"
                    disabled={send.isPending}
                    onClick={() => dispatch("email", paymentLink(depositAmount, "deposit"), "Deposit link")}
                  >
                    <Mail className="mr-1 h-3 w-3" /> Email
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-xs"
                    disabled={send.isPending}
                    onClick={() => dispatch("sms", paymentLink(depositAmount, "deposit"), "Deposit link")}
                  >
                    <Phone className="mr-1 h-3 w-3" /> Text
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
