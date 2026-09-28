import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { requestWorkingPatternChange, setWorkingPattern } from "@/lib/clinic.functions";
import {
  WEEKDAYS,
  fullPattern,
  minutesOf,
  rowLabel,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileMode, ProfileSubject } from "./profile-types";

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

/**
 * The seven-day working pattern as hour bars. Staff ask for a change; a
 * manager with Edit staff profiles edits the hours in place.
 */
export function WorkingPatternCard({
  mode,
  subject,
  pattern,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  pattern: PatternRow[];
}) {
  const queryClient = useQueryClient();
  const rows = fullPattern(pattern);
  const hours = weeklyHours(rows);

  const [askOpen, setAskOpen] = useState(false);
  const [note, setNote] = useState("");
  const [asked, setAsked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatternRow[]>(rows);

  useEffect(() => {
    if (!editing) setDraft(fullPattern(pattern));
  }, [pattern, editing]);

  const ask = useServerFn(requestWorkingPatternChange);
  const askChange = useMutation({
    mutationFn: () => ask({ data: { note: note.trim() } }),
    onSuccess: () => {
      setAsked(true);
      setAskOpen(false);
      setNote("");
      toast.success("Change requested");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useServerFn(setWorkingPattern);
  const savePattern = useMutation({
    mutationFn: () =>
      save({
        data: {
          userId: subject.userId,
          rows: draft.map((r) => ({
            weekday: r.weekday,
            start: r.start || null,
            end: r.end || null,
          })),
        },
      }),
    onSuccess: () => {
      setEditing(false);
      toast.success("Hours saved");
      queryClient.invalidateQueries({ queryKey: ["staff-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["staff-profile", subject.userId] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDraftRow = (weekday: number, patch: Partial<PatternRow>) =>
    setDraft((d) => d.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));

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
        {mode === "self" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "shrink-0",
              asked && "bg-success-bg text-success-ink hover:bg-success-bg",
            )}
            disabled={asked}
            onClick={() => setAskOpen(true)}
            data-qc={asked ? "pattern-change-requested" : "pattern-request-change"}
          >
            {asked ? (
              <>
                Change requested <Check className="h-3.5 w-3.5" />
              </>
            ) : (
              "Request a change"
            )}
          </Button>
        ) : mode === "manage" && !editing && !subject.revoked ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setEditing(true)}
            data-qc="pattern-edit"
          >
            Edit hours
          </Button>
        ) : null}
      </div>

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
                  <Input
                    id={`pat-start-${r.weekday}`}
                    type="time"
                    value={r.start ?? ""}
                    onChange={(e) => setDraftRow(r.weekday, { start: e.target.value || null })}
                    disabled={off}
                    data-qc={`pattern-start-${r.weekday}`}
                  />
                </div>
                <div className="field-stack">
                  <Label htmlFor={`pat-end-${r.weekday}`} className="sr-only">
                    {WEEKDAYS[r.weekday]} end
                  </Label>
                  <Input
                    id={`pat-end-${r.weekday}`}
                    type="time"
                    value={r.end ?? ""}
                    onChange={(e) => setDraftRow(r.weekday, { end: e.target.value || null })}
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
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-sm text-muted-foreground">{weeklyHours(draft)} hours a week</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={savePattern.isPending}
                onClick={() => savePattern.mutate()}
                data-qc="pattern-save"
              >
                {savePattern.isPending ? "Saving…" : "Save hours"}
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
            data-qc="metric:schedule.weeklyHours"
          >
            {hours} hours a week
          </p>
        </>
      )}

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request a change to your hours</DialogTitle>
            <DialogDescription>
              Say what you would like to change. Your manager will update the pattern and the diary
              follows.
            </DialogDescription>
          </DialogHeader>
          <div className="field-stack">
            <Label htmlFor="pattern-note">What should change?</Label>
            <Textarea
              id="pattern-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Move Thursday to 09:00–17:00 from November"
              className="rounded-xl"
              data-qc="pattern-note"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAskOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={askChange.isPending || !note.trim()}
              onClick={() => askChange.mutate()}
              data-qc="pattern-request-send"
            >
              {askChange.isPending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
