import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { addTimeOff, listAppointments, requestTimeOff } from "@/lib/clinic.functions";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  MONTHS_LONG,
  TIME_OFF_TYPE_LABEL,
  addDays,
  dayKeyOf,
  fullPattern,
  isWorkingDay,
  monthGrid,
  previousMonth,
  shortDay,
  timeOffLabel,
  workingDaysBetween,
  yearMonthOf,
  type PatternRow,
  type TimeOffType,
} from "@/lib/staff-schedule";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SELECT_CLASS } from "./personal-details-card";
import type { ProfileMode, ProfileSubject } from "./profile-types";

const TYPES: TimeOffType[] = ["holiday", "training", "sickness", "other"];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Request time off (self → requestTimeOff, lands pending) or add it for a
 * colleague (manage → addTimeOff, lands approved). Tap the first day, then
 * the last; half days at either end; the working-day count skips days off.
 */
export function TimeOffSheet({
  open,
  onOpenChange,
  mode,
  subject,
  pattern,
  todayKey,
  hasSeparateManager,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ProfileMode;
  subject: ProfileSubject;
  pattern: PatternRow[];
  todayKey: string;
  hasSeparateManager: boolean;
}) {
  const queryClient = useQueryClient();
  const full = useMemo(() => fullPattern(pattern), [pattern]);
  const [type, setType] = useState<TimeOffType>("holiday");
  const [view, setView] = useState(() => yearMonthOf(todayKey));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [startHalf, setStartHalf] = useState<"full" | "half">("full");
  const [endHalf, setEndHalf] = useState<"full" | "half">("full");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType("holiday");
      setView(yearMonthOf(todayKey));
      setStart(null);
      setEnd(null);
      setPicking(false);
      setStartHalf("full");
      setEndHalf("full");
      setNote("");
      setDone(null);
    }
  }, [open, todayKey]);

  const lo = start && end ? (start <= end ? start : end) : start;
  const hi = start && end ? (start <= end ? end : start) : start;
  const workDays = lo && hi ? workingDaysBetween(lo, hi, full, startHalf, endHalf) : 0;
  const calendarDays =
    lo && hi ? Math.round((Date.parse(hi) - Date.parse(lo)) / 86_400_000) + 1 : 0;

  const cells = useMemo(() => monthGrid(view.year, view.month), [view]);

  const fetchAppointments = useServerFn(listAppointments);
  const impact = useQuery({
    queryKey: ["timeoff-impact", subject.userId, lo, hi],
    queryFn: () =>
      fetchAppointments({
        data: {
          from: `${lo}T00:00:00.000Z`,
          to: `${addDays(hi!, 1)}T00:00:00.000Z`,
          practitioner_id: subject.userId,
        },
      }),
    enabled: open && Boolean(lo && hi),
  });
  const patients = useMemo(() => {
    const set = new Set<string>();
    for (const a of (impact.data ?? []) as {
      id: string;
      patient_id?: string | null;
      starts_at: string;
      status: string | null;
    }[]) {
      if (a.status === "cancelled") continue;
      const key = dayKeyOf(a.starts_at);
      if (lo && hi && key >= lo && key <= hi) set.add(a.patient_id ?? a.id);
    }
    return set.size;
  }, [impact.data, lo, hi]);

  const requestFn = useServerFn(requestTimeOff);
  const addFn = useServerFn(addTimeOff);
  const submit = useMutation({
    mutationFn: async () => {
      if (!lo || !hi) throw new Error("Pick the days first.");
      const body = {
        type,
        startsOn: lo,
        endsOn: hi,
        ...(startHalf === "half" ? { startHalf } : {}),
        ...(endHalf === "half" ? { endHalf } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      return mode === "self"
        ? requestFn({ data: body })
        : addFn({ data: { userId: subject.userId, ...body } });
    },
    onSuccess: () => {
      setDone(`${TIME_OFF_TYPE_LABEL[type]} · ${timeOffLabel({ starts_on: lo!, ends_on: hi! })}`);
      queryClient.invalidateQueries({ queryKey: ["staff-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["staff-profile", subject.userId] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = open && !done && Boolean(start || note.trim());
  const leaveGuard = useUnsavedChanges(dirty, "timeoff-unsaved");

  const pick = (key: string) => {
    if (picking && start) {
      setEnd(key);
      setPicking(false);
    } else {
      setStart(key);
      setEnd(key);
      setPicking(true);
    }
  };

  const first = subject.fullName.replace(/^(Dr|Mr|Mrs|Ms|Miss|Mx|Prof)\.?\s+/i, "").split(" ")[0];
  const title = mode === "self" ? "Request time off" : `Add time off for ${first}`;

  return (
    <>
      {leaveGuard}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[520px]"
          data-qc="timeoff-sheet"
        >
          <SheetHeader className="px-7 pb-4 pt-6 text-left">
            <SheetTitle className="text-2xl font-semibold tracking-[-0.01em]">{title}</SheetTitle>
            <SheetDescription className="sr-only">
              Choose the type and the days, then send.
            </SheetDescription>
          </SheetHeader>

          {done ? (
            <div
              role="status"
              className="flex flex-1 flex-col items-center justify-center gap-3.5 px-7 py-10 text-center"
              data-qc="timeoff-done"
            >
              <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-success-bg text-success-ink">
                <Check className="h-8 w-8" strokeWidth={2.2} />
              </span>
              <p className="text-[22px] font-semibold text-foreground">
                {mode === "self" ? "Request sent" : "Time off added"}
              </p>
              <p className="max-w-[320px] text-sm leading-relaxed text-muted-foreground">
                {mode === "self"
                  ? `${done} is with your ${hasSeparateManager ? "manager" : "clinic owner"}. It shows as pending in your schedule until it’s approved.`
                  : `${done} is on ${first}’s schedule and the front desk won’t book them on those days.`}
              </p>
              <Button
                type="button"
                className="mt-2 h-11 px-6"
                onClick={() => onOpenChange(false)}
                data-qc="timeoff-done-close"
              >
                Back to schedule
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-1 flex-col gap-5 px-7 pb-5">
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-2.5 text-sm font-semibold text-foreground">Type</legend>
                  <div className="flex flex-wrap gap-2">
                    {TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={type === t}
                        onClick={() => setType(t)}
                        className={cn(
                          "h-10 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors",
                          type === t
                            ? "bg-foreground text-background"
                            : "bg-glass-2 text-foreground shadow-inset-hi hover:bg-[rgba(47,63,102,0.08)]",
                        )}
                        data-qc={`timeoff-type-${t}`}
                      >
                        {TIME_OFF_TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                      Dates ·
                      <button
                        type="button"
                        aria-label="Previous month"
                        className="grid h-7 w-7 cursor-pointer place-items-center rounded-full hover:bg-glass-2"
                        onClick={() => setView(previousMonth(view.year, view.month))}
                        data-qc="timeoff-prev-month"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span data-qc="timeoff-month">
                        {MONTHS_LONG[view.month - 1]} {view.year}
                      </span>
                      <button
                        type="button"
                        aria-label="Next month"
                        className="grid h-7 w-7 cursor-pointer place-items-center rounded-full hover:bg-glass-2"
                        onClick={() =>
                          setView(
                            view.month === 12
                              ? { year: view.year + 1, month: 1 }
                              : { year: view.year, month: view.month + 1 },
                          )
                        }
                        data-qc="timeoff-next-month"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </span>
                    <span className="text-xs text-muted-foreground" data-qc="timeoff-hint">
                      {picking ? "Now tap the last day" : "Tap the first day, then the last"}
                    </span>
                  </div>
                  <div className="rounded-[20px] bg-glass-2 p-3.5 shadow-inset-hi">
                    <div className="grid grid-cols-7 gap-y-1 text-center">
                      {DOW.map((d, i) => (
                        <div
                          key={`${d}-${i}`}
                          className="pb-1 text-xs font-semibold text-muted-foreground"
                        >
                          {d}
                        </div>
                      ))}
                      {cells.map((c, i) => {
                        if (!c.key || !c.day)
                          return <div key={`b-${i}`} className="h-10" aria-hidden />;
                        const edge = c.key === lo || c.key === hi;
                        const mid = Boolean(lo && hi && c.key > lo && c.key < hi);
                        const works = isWorkingDay(full, c.key);
                        const past = c.key < todayKey;
                        return (
                          <button
                            key={c.key}
                            type="button"
                            aria-label={shortDay(c.key, true)}
                            aria-pressed={edge || mid}
                            disabled={past && mode === "self"}
                            onClick={() => pick(c.key!)}
                            className={cn(
                              "h-10 cursor-pointer text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                              edge
                                ? "rounded-xl bg-foreground font-bold text-background"
                                : mid
                                  ? "rounded-none bg-accent-soft font-medium text-foreground"
                                  : cn(
                                      "rounded-xl font-medium hover:bg-[rgba(47,63,102,0.08)]",
                                      works ? "text-foreground" : "text-ink-3",
                                    ),
                            )}
                            data-qc={`timeoff-day-${c.key}`}
                          >
                            {c.day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {lo && hi ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="field-stack">
                          <Label
                            htmlFor="timeoff-start-half"
                            className="text-[13px] font-normal text-muted-foreground"
                          >
                            {shortDay(lo, true)}
                          </Label>
                          <select
                            id="timeoff-start-half"
                            value={startHalf}
                            onChange={(e) => setStartHalf(e.target.value as "full" | "half")}
                            className={SELECT_CLASS}
                            data-qc="timeoff-start-half"
                          >
                            <option value="full">Full day</option>
                            <option value="half">Afternoon only</option>
                          </select>
                        </div>
                        <div className="field-stack">
                          <Label
                            htmlFor="timeoff-end-half"
                            className="text-[13px] font-normal text-muted-foreground"
                          >
                            {shortDay(hi, true)}
                          </Label>
                          <select
                            id="timeoff-end-half"
                            value={endHalf}
                            onChange={(e) => setEndHalf(e.target.value as "full" | "half")}
                            className={SELECT_CLASS}
                            disabled={lo === hi}
                            data-qc="timeoff-end-half"
                          >
                            <option value="full">Full day</option>
                            <option value="half">Morning only</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-[15px]" data-qc="timeoff-working-days">
                        <strong className="font-bold text-foreground">
                          {workDays} working day{workDays === 1 ? "" : "s"}
                        </strong>{" "}
                        {workDays < calendarDays ? (
                          <span className="text-muted-foreground">
                            · {mode === "self" ? "your" : "their"} days off are skipped
                          </span>
                        ) : null}
                      </p>
                    </>
                  ) : null}
                </div>

                {patients > 0 ? (
                  <div
                    className="flex flex-col gap-1.5 rounded-[18px] bg-warning-bg p-4 text-warning-ink"
                    data-qc="timeoff-impact"
                  >
                    <p className="text-[15px] font-bold">
                      {patients} patient{patients === 1 ? " is" : "s are"} booked on these days
                    </p>
                    <p className="text-[13px] leading-relaxed">
                      Once approved, the front desk gets a list to rebook them and{" "}
                      {mode === "self" ? "you won’t" : `${first} won’t`} be booked on these days.
                    </p>
                  </div>
                ) : null}

                <div className="field-stack">
                  <Label htmlFor="timeoff-note">
                    {mode === "self" ? "Note to your manager" : "Note"}{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="timeoff-note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="rounded-xl"
                    data-qc="timeoff-note"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-edge-2 px-7 py-4">
                <span className="text-[13px] text-muted-foreground">
                  {mode === "self"
                    ? hasSeparateManager
                      ? "Goes to your clinic manager"
                      : "Goes to the clinic owner"
                    : "Lands approved"}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={submit.isPending || !lo || !hi}
                    onClick={() => submit.mutate()}
                    data-qc="timeoff-submit"
                  >
                    {submit.isPending
                      ? "Sending…"
                      : mode === "self"
                        ? "Send request"
                        : "Add time off"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
