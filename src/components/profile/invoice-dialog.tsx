import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import {
  createPractitionerInvoice,
  getClinicDetails,
  getMyEarnings,
  listPractitionerInvoices,
} from "@/lib/clinic.functions";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  MONTHS_LONG,
  initialsOf,
  invoiceNumber,
  invoicePeriod,
  monthWindowIso,
  nextInvoiceSendDate,
  previousMonth,
  yearMonthOf,
} from "@/lib/staff-schedule";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildInvoiceDocument } from "@/lib/invoice-document";
import { InvoicePrintSheet, InvoiceSheet } from "./invoice-sheet";
import { printInvoice, shortDate } from "./profile-helpers";
import type { InvoiceRowLike, ProfileMode, ProfileSubject } from "./profile-types";

type Recipient = "payroll" | "owner";
type Stage = "form" | "scheduled" | "sent";

/**
 * Create & send invoice: the current month (schedule for the 1st, or send now)
 * or the previous one, to payroll or the clinic owner, with a live preview.
 */
export function InvoiceDialog({
  open,
  onOpenChange,
  mode,
  subject,
  todayKey,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** self: your own invoice; manage: raising a colleague's (Set staff commission). */
  mode: ProfileMode;
  subject: ProfileSubject;
  todayKey: string;
  initial?: { year: number; month: number } | undefined;
}) {
  const queryClient = useQueryClient();
  const self = mode === "self";
  const first =
    subject.fullName.replace(/^(Dr|Mr|Mrs|Ms|Miss|Mx|Prof)\.?\s+/i, "").split(" ")[0] ??
    subject.fullName;
  const current = useMemo(() => yearMonthOf(todayKey), [todayKey]);
  const previous = useMemo(() => previousMonth(current.year, current.month), [current]);
  const options = useMemo(() => {
    const list = [current, previous];
    if (initial && !list.some((o) => o.year === initial.year && o.month === initial.month)) {
      list.push(initial);
    }
    return list;
  }, [current, previous, initial]);

  const [period, setPeriod] = useState(initial ?? current);
  const [recipient, setRecipient] = useState<Recipient>("payroll");
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<Stage>("form");

  useEffect(() => {
    if (open) {
      setPeriod(initial ?? current);
      setStage("form");
      setNote("");
    }
  }, [open, initial, current]);

  const fetchClinic = useServerFn(getClinicDetails);
  const fetchInvoices = useServerFn(listPractitionerInvoices);
  const fetchEarnings = useServerFn(getMyEarnings);
  const create = useServerFn(createPractitionerInvoice);

  const clinic = useQuery({
    queryKey: ["clinic-details"],
    queryFn: () => fetchClinic(),
    enabled: open,
  });
  const invoices = useQuery({
    queryKey: ["practitioner-invoices", self ? "self" : subject.userId],
    queryFn: () => fetchInvoices({ data: self ? {} : { userId: subject.userId } }),
    enabled: open,
  });
  const range = useMemo(() => monthWindowIso(period.year, period.month), [period]);
  const earnings = useQuery({
    queryKey: ["my-earnings", self ? "self" : subject.userId, range.from, range.to],
    queryFn: () => fetchEarnings({ data: self ? range : { ...range, userId: subject.userId } }),
    enabled: open,
  });

  const rows = (invoices.data ?? []) as InvoiceRowLike[];
  const bounds = invoicePeriod(period.year, period.month);
  const existing = rows.find((r) => r.period_start === bounds.start);
  const inProgress = period.year === current.year && period.month === current.month;
  const alreadySent = existing?.status === "sent" || existing?.status === "paid";
  const scheduled = existing?.status === "scheduled";
  const sendDate = nextInvoiceSendDate(period.year, period.month);
  const monthName = MONTHS_LONG[period.month - 1] ?? "";

  const qty = alreadySent ? existing.treatments : (earnings.data?.treatments ?? 0);
  const amount = alreadySent ? existing.amount : (earnings.data?.earnedShare ?? 0);
  const number =
    existing?.number ?? invoiceNumber(initialsOf(subject.fullName), period.year, period.month);
  const issued = existing?.sent_at?.slice(0, 10) ?? (inProgress ? sendDate : todayKey);

  const clinicName = (clinic.data?.name as string | undefined) ?? "Your clinic";
  const clinicEmail = (clinic.data?.email as string | null | undefined) ?? null;
  const recipientName = recipient === "payroll" ? "Payroll team" : "Clinic owner";
  const recipientLine =
    recipient === "payroll" ? (clinicEmail ?? "Clinic email not set") : "Clinic owner";

  const doc = useMemo(
    () =>
      buildInvoiceDocument({
        number,
        issuedOn: issued,
        year: period.year,
        month: period.month,
        from: { name: subject.fullName, line1: subject.jobTitle, line2: subject.email },
        billTo: { name: clinicName, line1: recipientName, line2: recipientLine },
        qty,
        amount,
        note: alreadySent ? (existing.note ?? null) : note.trim() || null,
        status: alreadySent
          ? (existing.status as "sent" | "paid")
          : scheduled
            ? "scheduled"
            : "draft",
      }),
    [
      number,
      issued,
      period.year,
      period.month,
      subject.fullName,
      subject.jobTitle,
      subject.email,
      clinicName,
      recipientName,
      recipientLine,
      qty,
      amount,
      existing,
      note,
      alreadySent,
      scheduled,
    ],
  );

  const submit = useMutation({
    mutationFn: (sendMode: "send" | "schedule") =>
      create({
        data: {
          year: period.year,
          month: period.month,
          recipient,
          mode: sendMode,
          ...(self ? {} : { userId: subject.userId }),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      }),
    onSuccess: (_res, sendMode) => {
      setStage(sendMode === "schedule" ? "scheduled" : "sent");
      queryClient.invalidateQueries({ queryKey: ["practitioner-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = open && stage === "form" && note.trim().length > 0;
  const leaveGuard = useUnsavedChanges(dirty, "invoice-unsaved");

  const doneTitle = stage === "scheduled" ? `Scheduled for ${shortDate(sendDate)}` : "Invoice sent";
  const whose = self ? "your" : `${first}’s`;
  const doneSub =
    stage === "scheduled"
      ? `We’ll send it to the ${recipientName.toLowerCase()} on ${shortDate(sendDate)} with the final ${monthName} figures.${self ? " You can change it until then." : ` ${first} has been told.`}`
      : `The ${recipientName.toLowerCase()} has ${whose} ${monthName} invoice.${self ? " You’ll see it marked Paid in Performance & earnings once they settle it." : ` ${first} has been told; mark it paid here once it is settled.`}`;

  return (
    <>
      {leaveGuard}
      <InvoicePrintSheet doc={open ? doc : null} />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[calc(calc(100*var(--app-dvh))-2rem)] max-w-[1000px] gap-0 overflow-y-auto p-0 md:grid-cols-[380px_minmax(0,1fr)]"
          data-qc="invoice-dialog"
        >
          <div className="flex flex-col gap-5 p-7">
            <div className="pr-8">
              <DialogTitle className="text-2xl font-semibold tracking-[-0.01em]">
                Create invoice
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {self
                  ? "Built from your completed treatments."
                  : `Built from ${first}’s completed treatments.`}
              </DialogDescription>
            </div>

            {stage === "form" ? (
              <div className="flex flex-1 flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-foreground">Invoice period</p>
                  <div className="flex gap-2" role="group" aria-label="Invoice period">
                    {options.map((o) => {
                      const on = o.year === period.year && o.month === period.month;
                      const row = rows.find(
                        (r) => r.period_start === invoicePeriod(o.year, o.month).start,
                      );
                      const suffix =
                        row?.status === "paid" || row?.status === "sent"
                          ? " · sent"
                          : row?.status === "scheduled"
                            ? " · scheduled"
                            : "";
                      return (
                        <button
                          key={`${o.year}-${o.month}`}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setPeriod(o)}
                          className={cn(
                            "h-11 flex-1 cursor-pointer rounded-2xl border-2 text-sm font-semibold transition-colors",
                            on
                              ? "border-accent-deep bg-accent-soft text-foreground"
                              : "border-edge-2 bg-card text-foreground hover:bg-glass-2",
                          )}
                          data-qc={`invoice-period-${o.year}-${String(o.month).padStart(2, "0")}`}
                        >
                          {MONTHS_LONG[o.month - 1]}
                          {suffix}
                        </button>
                      );
                    })}
                  </div>
                  {inProgress && !alreadySent && !scheduled ? (
                    <p
                      className="rounded-2xl bg-warning-bg px-3.5 py-3 text-[13px] leading-snug text-warning-ink"
                      data-qc="invoice-note-progress"
                    >
                      {monthName} isn’t over yet. Schedule it for {shortDate(sendDate)} and it will
                      include every day of the month.
                    </p>
                  ) : null}
                  {alreadySent ? (
                    <p
                      className="rounded-2xl bg-success-bg px-3.5 py-3 text-[13px] leading-snug text-success-ink"
                      data-qc="invoice-note-sent"
                    >
                      {monthName} was sent
                      {existing.sent_at ? ` on ${shortDate(existing.sent_at.slice(0, 10))}` : ""}
                      {existing.status === "paid"
                        ? ` and paid${existing.paid_at ? ` on ${shortDate(existing.paid_at.slice(0, 10))}` : ""}`
                        : ""}
                      . You can download a copy.
                    </p>
                  ) : null}
                  {scheduled && existing.scheduled_for ? (
                    <p
                      className="rounded-2xl bg-glass-2 px-3.5 py-3 text-[13px] leading-snug text-foreground shadow-inset-hi"
                      data-qc="invoice-note-scheduled"
                    >
                      {monthName} is scheduled to go on{" "}
                      {shortDate(existing.scheduled_for.slice(0, 10))}. Sending now replaces that.
                    </p>
                  ) : null}
                </div>

                {!alreadySent ? (
                  <>
                    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                      <legend className="mb-2 text-sm font-semibold text-foreground">
                        Send to
                      </legend>
                      {(
                        [
                          ["payroll", "Payroll team", clinicEmail ?? "Clinic email not set"],
                          ["owner", "Clinic owner", "To their SQINOS inbox and email"],
                        ] as const
                      ).map(([id, name, sub]) => {
                        const on = recipient === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setRecipient(id)}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors",
                              on
                                ? "border-accent-deep bg-accent-soft"
                                : "border-edge-2 bg-card hover:bg-glass-2",
                            )}
                            data-qc={`invoice-recipient-${id}`}
                          >
                            <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 border-foreground">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  on ? "bg-foreground" : "bg-transparent",
                                )}
                              />
                            </span>
                            <span>
                              <span className="block text-[15px] font-semibold text-foreground">
                                {name}
                              </span>
                              <span className="block text-[13px] text-muted-foreground">{sub}</span>
                            </span>
                          </button>
                        );
                      })}
                    </fieldset>

                    <div className="field-stack">
                      <Label htmlFor="invoice-note">
                        Note <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Textarea
                        id="invoice-note"
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Anything payroll should know"
                        className="rounded-xl"
                        data-qc="invoice-note"
                      />
                    </div>
                  </>
                ) : null}

                <div className="flex-1" />

                {alreadySent ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full"
                    onClick={() => printInvoice(doc)}
                    data-qc="invoice-download"
                  >
                    Download PDF
                  </Button>
                ) : inProgress ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      className="h-12 w-full"
                      disabled={submit.isPending}
                      onClick={() => submit.mutate("schedule")}
                      data-qc="invoice-schedule"
                    >
                      {submit.isPending && submit.variables === "schedule"
                        ? "Scheduling…"
                        : `Schedule to send on ${shortDate(sendDate)}`}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        disabled={submit.isPending || qty === 0}
                        onClick={() => submit.mutate("send")}
                        data-qc="invoice-send-now"
                      >
                        {submit.isPending && submit.variables === "send" ? "Sending…" : "Send now"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => printInvoice(doc)}
                        data-qc="invoice-download"
                      >
                        Download PDF
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      className="h-12"
                      disabled={submit.isPending || qty === 0}
                      onClick={() => submit.mutate("send")}
                      data-qc="invoice-send-now"
                    >
                      {submit.isPending ? "Sending…" : "Send now"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12"
                      onClick={() => printInvoice(doc)}
                      data-qc="invoice-download"
                    >
                      Download PDF
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div
                role="status"
                className="flex flex-1 flex-col items-center justify-center gap-3.5 py-8 text-center"
                data-qc="invoice-done"
              >
                <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-success-bg text-success-ink">
                  <Check className="h-8 w-8" strokeWidth={2.2} />
                </span>
                <p className="text-[22px] font-semibold text-foreground">{doneTitle}</p>
                <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">
                  {doneSub}
                </p>
                <Button
                  type="button"
                  className="mt-2 h-11 px-6"
                  onClick={() => onOpenChange(false)}
                  data-qc="invoice-done-close"
                >
                  Done
                </Button>
              </div>
            )}
          </div>

          <div className="hidden flex-col gap-3 bg-glass-2 p-7 shadow-inset-hi md:flex">
            <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Preview
            </p>
            <InvoiceSheet doc={doc} className="flex-1" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
