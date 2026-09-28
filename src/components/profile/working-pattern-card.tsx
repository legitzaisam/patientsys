import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Info } from "lucide-react";
import {
  requestWorkingPatternChange,
  reviewWorkingPatternChange,
  setWorkingPattern,
  withdrawWorkingPatternChange,
} from "@/lib/clinic.functions";
import {
  WEEKDAYS,
  fullPattern,
  minutesOf,
  patternChanges,
  rowLabel,
  samePattern,
  weeklyHours,
  type PatternRow,
} from "@/lib/staff-schedule";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TimeField } from "@/components/ui/time-field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  PatternRequestView,
  ProfileMode,
  ProfileSubject,
  ProfileViewer,
} from "./profile-types";

const AXIS_START = 7 * 60;
const AXIS_END = 21 * 60;
const AXIS_LABELS = ["07:00", "11:00", "15:00", "19:00", "21:00"];

function barGeometry(row: PatternRow): { left: number; width: number } | null {
  if (!row.start || !row.end) return null;
  const a = Math.max(AXIS_START, minutesOf(row.start));
  const b = Math.min(AXIS_END, minutesOf(row.end));
  if (b <= a) return null;
  const span = AXIS_END - AXIS_START;
  return { left: ((a - AXIS_START) / span) * 100, width: ((b - a) / span) * 100 };
}

function firstName(fullName: string) {
  return fullName.replace(/^(Dr|Mr|Mrs|Ms|Miss|Mx|Prof)\.?\s+/i, "").split(" ")[0] ?? fullName;
}

/** The days that differ, "Thu · 09:00–17:00 (was 12:00–20:00)". */
function ChangeList({ current, proposed }: { current: PatternRow[]; proposed: PatternRow[] }) {
  const changes = patternChanges(current, proposed);
  if (changes.length === 0) return <p className="text-sm text-muted-foreground">No change.</p>;
  return (
    <ul className="flex flex-col gap-1" data-qc="pattern-change-list">
      {changes.map((c) => (
        <li
          key={c.weekday}
          className="flex items-baseline gap-2 text-sm"
          data-qc="pattern-change-row"
        >
          <span className="w-8 shrink-0 font-semibold text-foreground">{WEEKDAYS[c.weekday]}</span>
          <span className="tabular-nums text-foreground">{c.to}</span>
          <span className="text-xs text-muted-foreground">(was {c.from})</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The seven-day working pattern as hour bars. The owner (and anyone with Edit
 * staff profiles, on a colleague's page) edits the hours in place; other staff
 * edit their own and send the result for approval, which waits here as a
 * pending request until the owner or a manager decides.
 */
export function WorkingPatternCard({
  mode,
  subject,
  viewer,
  pattern,
  request,
  hasSeparateManager,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  viewer: ProfileViewer;
  pattern: PatternRow[];
  request: PatternRequestView | null;
  hasSeparateManager: boolean;
}) {
  const queryClient = useQueryClient();
  const rows = fullPattern(pattern);
  const hours = weeklyHours(rows);
  const selfDirect = mode === "self" && Boolean(viewer.isOwner || viewer.isAdmin);
  const direct = mode === "manage" || selfDirect;
  const canEdit = mode !== "frontdesk" && !subject.revoked && (mode === "manage" || !request);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatternRow[]>(rows);
  const [note, setNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reviewerNote, setReviewerNote] = useState("");

  useEffect(() => {
    if (!editing) setDraft(fullPattern(pattern));
  }, [pattern, editing]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["staff-profile", subject.userId] });
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const draftRows = () =>
    draft.map((r) => ({ weekday: r.weekday, start: r.start || null, end: r.end || null }));

  const saveFn = useServerFn(setWorkingPattern);
  const requestFn = useServerFn(requestWorkingPatternChange);
  const submit = useMutation({
    mutationFn: () =>
      mode === "manage"
        ? saveFn({ data: { userId: subject.userId, rows: draftRows() } })
        : requestFn({ data: { rows: draftRows(), ...(note.trim() ? { note: note.trim() } : {}) } }),
    onSuccess: (result) => {
      setEditing(false);
      setNote("");
      const applied = mode === "manage" || (result as { applied?: boolean }).applied;
      toast.success(applied ? "Hours saved" : "Sent for approval");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdrawFn = useServerFn(withdrawWorkingPatternChange);
  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Request withdrawn");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewFn = useServerFn(reviewWorkingPatternChange);
  const review = useMutation({
    mutationFn: (input: { id: string; approve: boolean; reviewerNote?: string }) =>
      reviewFn({ data: input }),
    onSuccess: (_r, input) => {
      toast.success(input.approve ? "Hours approved" : "Request declined");
      setDeclining(false);
      setReviewerNote("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDraftRow = (weekday: number, patch: Partial<PatternRow>) =>
    setDraft((d) => d.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));

  const unchanged = samePattern(rows, draft);
  const approverLabel =
    mode === "self" && request?.requires_owner
      ? "the clinic owner"
      : hasSeparateManager
        ? "your manager"
        : "the clinic owner";

  return (
    <Card className="p-6" data-qc="working-pattern">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Working pattern</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "self"
              ? "The front desk can only book you inside these hours."
              : "The front desk can only book them inside these hours."}
          </p>
        </div>
        {!editing && mode === "self" && request ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 bg-success-bg text-success-ink hover:bg-success-bg"
            disabled
            data-qc="pattern-change-requested"
          >
            Change requested <Check className="h-3.5 w-3.5" />
          </Button>
        ) : !editing && canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setEditing(true)}
            data-qc={direct ? "pattern-edit" : "pattern-request-change"}
          >
            {direct ? "Edit hours" : "Request a change"}
          </Button>
        ) : null}
      </div>

      {request && !editing ? (
        <div
          className={cn(
            "mb-4 flex flex-col gap-3 rounded-2xl p-4",
            mode === "manage" ? "bg-accent-soft" : "bg-glass-2 shadow-inset-hi",
          )}
          data-qc={mode === "manage" ? "pattern-proposal" : "pattern-pending"}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {mode === "manage"
                  ? `Proposed change from ${firstName(subject.fullName)}`
                  : `Change requested · awaiting ${approverLabel}`}
              </p>
              {request.note ? (
                <p className="mt-0.5 text-xs text-muted-foreground" data-qc="pattern-request-note">
                  “{request.note}”
                </p>
              ) : null}
            </div>
            {mode === "self" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs"
                disabled={withdraw.isPending}
                onClick={() => withdraw.mutate(request.id)}
                data-qc="pattern-request-withdraw"
              >
                Withdraw
              </Button>
            ) : null}
          </div>
          <ChangeList current={rows} proposed={request.rows} />
          {mode === "manage" ? (
            request.requires_owner && !viewer.isOwner && !viewer.isAdmin ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> Only the clinic owner can decide this one.
              </p>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: request.id, approve: true })}
                  data-qc="pattern-approve"
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  disabled={review.isPending}
                  onClick={() => setDeclining(true)}
                  data-qc="pattern-decline"
                >
                  Decline
                </Button>
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className="flex flex-col gap-3" data-qc="pattern-editor">
          {draft.map((r) => {
            const off = !r.start && !r.end;
            return (
              <div
                key={r.weekday}
                className="grid grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3"
              >
                <span className="text-sm font-semibold text-foreground">{WEEKDAYS[r.weekday]}</span>
                <div className="field-stack">
                  <Label htmlFor={`pat-start-${r.weekday}`} className="sr-only">
                    {WEEKDAYS[r.weekday]} start
                  </Label>
                  <TimeField
                    id={`pat-start-${r.weekday}`}
                    value={r.start}
                    onChange={(v) => setDraftRow(r.weekday, { start: v })}
                    disabled={off}
                    data-qc={`pattern-start-${r.weekday}`}
                  />
                </div>
                <div className="field-stack">
                  <Label htmlFor={`pat-end-${r.weekday}`} className="sr-only">
                    {WEEKDAYS[r.weekday]} end
                  </Label>
                  <TimeField
                    id={`pat-end-${r.weekday}`}
                    value={r.end}
                    onChange={(v) => setDraftRow(r.weekday, { end: v })}
                    disabled={off}
                    data-qc={`pattern-end-${r.weekday}`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    off
                      ? setDraftRow(r.weekday, { start: "09:00", end: "17:00" })
                      : setDraftRow(r.weekday, { start: null, end: null })
                  }
                  data-qc={`pattern-toggle-${r.weekday}`}
                >
                  {off ? "Add hours" : "Day off"}
                </Button>
              </div>
            );
          })}
          {!direct ? (
            <>
              <p className="flex items-center gap-2 rounded-2xl bg-warning-bg px-3.5 py-3 text-xs text-warning-ink">
                <Info className="h-4 w-4 shrink-0" />
                New hours go to {approverLabel} for approval; the diary follows once they agree.
              </p>
              <div className="field-stack">
                <Label htmlFor="pattern-note">Note for the reviewer (optional)</Label>
                <Textarea
                  id="pattern-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Earlier Thursdays from November for the school run"
                  className="rounded-xl"
                  data-qc="pattern-note"
                />
              </div>
            </>
          ) : null}
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-sm text-muted-foreground">{weeklyHours(draft)} hours a week</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submit.isPending || unchanged}
                onClick={() => submit.mutate()}
                data-qc={direct ? "pattern-save" : "pattern-request-send"}
              >
                {submit.isPending
                  ? direct
                    ? "Saving…"
                    : "Sending…"
                  : direct
                    ? "Save hours"
                    : "Send for approval"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[48px_minmax(0,1fr)_110px] gap-x-3.5 pb-1.5 text-xs text-muted-foreground">
            <span />
            <span className="flex justify-between">
              {AXIS_LABELS.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </span>
            <span />
          </div>
          {rows.map((r) => {
            const geo = barGeometry(r);
            return (
              <div
                key={r.weekday}
                className="grid h-10 grid-cols-[48px_minmax(0,1fr)_110px] items-center gap-x-3.5"
                data-qc="pattern-row"
              >
                <span className="text-sm font-semibold text-foreground">{WEEKDAYS[r.weekday]}</span>
                <div className="relative h-[22px] rounded-full bg-glass-2 shadow-inset-hi">
                  {geo ? (
                    <div
                      className="absolute inset-y-0 rounded-full bg-foreground"
                      style={{ left: `${geo.left}%`, width: `${geo.width}%` }}
                    />
                  ) : null}
                </div>
                <span
                  className={cn(
                    "text-right text-sm tabular-nums",
                    geo ? "text-foreground" : "text-ink-3",
                  )}
                >
                  {rowLabel(r)}
                </span>
              </div>
            );
          })}
          <p
            className="mt-2.5 text-right text-sm text-muted-foreground"
            data-qc="pattern-weekly-hours"
          >
            {hours} hours a week
          </p>
        </>
      )}

      <Dialog open={declining} onOpenChange={setDeclining}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline these hours?</DialogTitle>
            <DialogDescription>
              {firstName(subject.fullName)} will be told, with your reason if you give one.
            </DialogDescription>
          </DialogHeader>
          <div className="field-stack">
            <Label htmlFor="pattern-decline-note">Reason (optional)</Label>
            <Textarea
              id="pattern-decline-note"
              rows={2}
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
              className="rounded-xl"
              data-qc="pattern-decline-note"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeclining(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={review.isPending || !request}
              onClick={() =>
                request &&
                review.mutate({
                  id: request.id,
                  approve: false,
                  ...(reviewerNote.trim() ? { reviewerNote: reviewerNote.trim() } : {}),
                })
              }
              data-qc="pattern-decline-confirm"
            >
              {review.isPending ? "Declining…" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
