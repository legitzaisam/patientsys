import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Info, Lock } from "lucide-react";
import { saveMyProfile, submitProfileChange, updateStaffMember } from "@/lib/clinic.functions";
import { checkEmail } from "@/lib/email";
import { WORKING_ARRANGEMENTS } from "@/lib/profile-change-policy";
import { joinStaffName, splitStaffName, STAFF_TITLES } from "@/lib/staff-name";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invalidateProfileQueries } from "./profile-helpers";
import type { ProfileMode, ProfileSubject, ProfileViewer } from "./profile-types";

export const SELECT_CLASS =
  "flex h-10 w-full rounded-xl border border-edge bg-glass-2 px-3 text-sm shadow-inset-hi outline-none transition-colors hover:border-edge-2 focus-visible:border-accent-deep focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

const ROLES = [
  { value: "owner", label: "Clinic owner" },
  { value: "manager", label: "Manager" },
  { value: "practitioner", label: "Practitioner" },
  { value: "front_desk", label: "Receptionist" },
] as const;

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

/** A read-only value well, with an optional lock for fields the owner manages. */
export function Tile({
  label,
  value,
  locked,
  children,
  qc,
}: {
  label: string;
  value: string;
  locked?: boolean;
  children?: React.ReactNode;
  qc?: string;
}) {
  return (
    <div className="rounded-2xl bg-glass-2 px-4 py-3.5 shadow-inset-hi" data-qc={qc}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {locked ? <Lock className="h-3 w-3" aria-label="Locked" /> : null}
      </p>
      <p className="mt-1 text-[15px] font-semibold text-foreground">{value || "—"}</p>
      {children}
    </div>
  );
}

type Draft = {
  title: string;
  fullName: string;
  jobTitle: string;
  workEmail: string;
  workingArrangement: string;
  role: string;
  commissionRate: string;
};

function draftOf(subject: ProfileSubject): Draft {
  const split = splitStaffName(subject.fullName);
  return {
    title: split.title,
    fullName: split.name,
    jobTitle: subject.jobTitle,
    workEmail: subject.email,
    workingArrangement: subject.workingArrangement,
    role: subject.role || "practitioner",
    commissionRate: String(subject.commissionRate ?? 0),
  };
}

/**
 * Name, job title, work email and working arrangement — and in manage mode
 * the access level and commission rate. Who saves what:
 *   self, owner or admin  → saveMyProfile applies straight away
 *   self, anyone else     → name and job title go for approval; email and
 *                           arrangement are locked (Request a change)
 *   manage                → updateStaffMember applies straight away
 */
export function PersonalDetailsCard({
  mode,
  subject,
  viewer,
  hasSeparateManager,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  viewer: ProfileViewer;
  hasSeparateManager: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(subject));
  const [toastLine, setToastLine] = useState<string | null>(null);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [lockedEmail, setLockedEmail] = useState(subject.email);
  const [lockedArrangement, setLockedArrangement] = useState(subject.workingArrangement);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!editing) setDraft(draftOf(subject));
  }, [subject, editing]);

  const direct = mode === "manage" || (mode === "self" && viewer.canSelfApply);
  const pendingJob = subject.requests.find(
    (r) => r.status === "pending" && r.job_title && r.job_title !== subject.jobTitle,
  )?.job_title;

  const saveMine = useServerFn(saveMyProfile);
  const saveTheirs = useServerFn(updateStaffMember);
  const submitChange = useServerFn(submitProfileChange);

  const save = useMutation({
    mutationFn: async () => {
      const fullName = joinStaffName(draft.title, draft.fullName);
      if (!draft.fullName.trim()) throw new Error("A name is needed.");
      if (mode === "manage") {
        return saveTheirs({
          data: {
            userId: subject.userId,
            role: draft.role as "owner" | "manager" | "practitioner" | "front_desk",
            fullName,
            jobTitle: draft.jobTitle,
            registrationBody: subject.registrationBody,
            registrationNumber: subject.registrationNumber,
            registrationExpiry: subject.registrationExpiry,
            insuranceProvider: subject.insuranceProvider,
            insuranceExpiry: subject.insuranceExpiry,
            qualifications: subject.qualifications,
            workingArrangement: draft.workingArrangement,
            ...(viewer.canCommission ? { commissionRate: Number(draft.commissionRate) || 0 } : {}),
          },
        });
      }
      if (viewer.canSelfApply) {
        const emailCheck = checkEmail(draft.workEmail, "work email");
        if (!emailCheck.ok) throw new Error(emailCheck.error);
        return saveMine({
          data: {
            fullName,
            jobTitle: draft.jobTitle,
            registrationBody: subject.registrationBody,
            registrationNumber: subject.registrationNumber,
            registrationExpiry: subject.registrationExpiry,
            insuranceProvider: subject.insuranceProvider,
            insuranceExpiry: subject.insuranceExpiry,
            qualifications: subject.qualifications,
            workEmail: emailCheck.email,
            workingArrangement: draft.workingArrangement,
          },
        });
      }
      return submitChange({
        data: {
          fullName,
          jobTitle: draft.jobTitle,
          registrationBody: subject.registrationBody,
          registrationNumber: subject.registrationNumber,
          registrationExpiry: subject.registrationExpiry,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
    },
    onSuccess: () => {
      setEditing(false);
      setNote("");
      setToastLine(
        direct
          ? "Saved."
          : viewer.requiresOwner
            ? "Sent to the clinic owner — you’ll be notified when it’s approved."
            : "Sent to your manager — you’ll be notified when it’s approved.",
      );
      invalidateProfileQueries(queryClient, subject.userId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestLocked = useMutation({
    mutationFn: async () => {
      const emailCheck = checkEmail(lockedEmail, "work email");
      if (!emailCheck.ok) throw new Error(emailCheck.error);
      return submitChange({
        data: {
          fullName: subject.fullName,
          jobTitle: subject.jobTitle,
          registrationBody: subject.registrationBody,
          registrationNumber: subject.registrationNumber,
          registrationExpiry: subject.registrationExpiry,
          workEmail: emailCheck.email,
          workingArrangement: lockedArrangement,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("Change request sent");
      setLockedOpen(false);
      setNote("");
      invalidateProfileQueries(queryClient, subject.userId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lockedHint = mode === "manage" ? undefined : "Locked · managed by your clinic owner";

  return (
    <Card className="flex flex-col gap-4 p-6" data-qc="personal-details">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Personal details</h2>
        {!editing && !subject.revoked ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(draftOf(subject));
              setToastLine(null);
              setEditing(true);
            }}
            data-qc="personal-details-edit"
          >
            Edit
          </Button>
        ) : null}
      </div>

      {toastLine ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl bg-success-bg px-3.5 py-3 text-sm font-semibold text-success-ink"
          data-qc="personal-details-status"
        >
          <Check className="h-4 w-4" /> {toastLine}
        </p>
      ) : null}

      {!editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Tile label="Name" value={subject.fullName} qc="tile-name" />
          <Tile label="Job title" value={subject.jobTitle} qc="tile-job">
            {pendingJob ? (
              <span
                className="mt-2 inline-flex rounded-full bg-warning-bg px-2.5 py-1 text-2xs font-semibold text-warning-ink"
                data-qc="pending-job"
              >
                “{pendingJob}”{" "}
                {mode === "self" && viewer.requiresOwner
                  ? "awaiting the clinic owner"
                  : "awaiting approval"}
              </span>
            ) : null}
          </Tile>
          <Tile label="Work email" value={subject.email} locked={!direct} qc="tile-email" />
          <Tile
            label="Working arrangement"
            value={subject.workingArrangement}
            locked={!direct}
            qc="tile-arrangement"
          />
          {mode === "manage" ? (
            <>
              <Tile label="Access level" value={roleLabel(subject.role)} qc="tile-role" />
              {viewer.canCommission ? (
                <Tile
                  label="Commission rate"
                  value={`${Number(subject.commissionRate ?? 0)}%`}
                  qc="tile-commission"
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-qc="personal-details-form">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2.5">
              <div className="field-stack">
                <Label htmlFor="pd-title">Title</Label>
                <select
                  id="pd-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">—</option>
                  {STAFF_TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-stack">
                <Label htmlFor="pd-name">Full name</Label>
                <Input
                  id="pd-name"
                  value={draft.fullName}
                  onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                  autoComplete="name"
                />
              </div>
            </div>
            <div className="field-stack">
              <Label htmlFor="pd-job">Job title</Label>
              <Input
                id="pd-job"
                value={draft.jobTitle}
                onChange={(e) => setDraft({ ...draft, jobTitle: e.target.value })}
                placeholder="e.g. Aesthetic practitioner"
              />
            </div>
            <div className="field-stack">
              <Label htmlFor="pd-email">Work email</Label>
              <Input
                id="pd-email"
                type="email"
                value={draft.workEmail}
                onChange={(e) => setDraft({ ...draft, workEmail: e.target.value })}
                disabled={!(mode === "self" && viewer.canSelfApply)}
                autoComplete="email"
              />
              {lockedHint && !viewer.canSelfApply ? (
                <p className="text-2xs text-muted-foreground">{lockedHint}</p>
              ) : mode === "manage" ? (
                <p className="text-2xs text-muted-foreground">Changed from the Team page.</p>
              ) : null}
            </div>
            <div className="field-stack">
              <Label htmlFor="pd-arrangement">Working arrangement</Label>
              <select
                id="pd-arrangement"
                value={draft.workingArrangement}
                onChange={(e) => setDraft({ ...draft, workingArrangement: e.target.value })}
                disabled={!direct}
                className={SELECT_CLASS}
                data-qc="working-arrangement"
              >
                <option value="">—</option>
                {WORKING_ARRANGEMENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                {draft.workingArrangement &&
                !(WORKING_ARRANGEMENTS as readonly string[]).includes(draft.workingArrangement) ? (
                  <option value={draft.workingArrangement}>{draft.workingArrangement}</option>
                ) : null}
              </select>
              {lockedHint && !viewer.canSelfApply ? (
                <p className="text-2xs text-muted-foreground">{lockedHint}</p>
              ) : null}
            </div>
            {mode === "manage" ? (
              <>
                <div className="field-stack">
                  <Label htmlFor="pd-role">Access level</Label>
                  <select
                    id="pd-role"
                    value={draft.role}
                    onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                    className={SELECT_CLASS}
                    data-qc="access-level"
                  >
                    {ROLES.filter(
                      (r) =>
                        (r.value !== "owner" || viewer.isOwner) &&
                        (r.value !== "manager" || hasSeparateManager),
                    ).map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                {viewer.canCommission ? (
                  <div className="field-stack">
                    <Label htmlFor="pd-commission">Commission rate</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="pd-commission"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        inputMode="decimal"
                        value={draft.commissionRate}
                        onChange={(e) => setDraft({ ...draft, commissionRate: e.target.value })}
                        className="w-28"
                        data-qc="commission-rate"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          {!direct ? (
            <>
              <p className="flex items-center gap-2 rounded-2xl bg-warning-bg px-3.5 py-3 text-xs text-warning-ink">
                <Info className="h-4 w-4 shrink-0" />
                Name and job title changes go to{" "}
                {viewer.requiresOwner ? "the clinic owner" : "your manager"} for approval before
                they show.
              </p>
              <div className="field-stack">
                <Label htmlFor="pd-note">Note for the reviewer (optional)</Label>
                <Textarea
                  id="pd-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why this should change"
                  className="rounded-xl"
                />
              </div>
            </>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {!direct ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mr-auto"
                onClick={() => {
                  setLockedEmail(subject.email);
                  setLockedArrangement(subject.workingArrangement);
                  setLockedOpen(true);
                }}
                data-qc="profile-request-locked"
              >
                Request a change to email or arrangement
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={save.isPending || !draft.fullName.trim()}
              onClick={() => save.mutate()}
              data-qc={direct ? "personal-details-save" : "profile-request-approval"}
            >
              {save.isPending ? "Saving…" : direct ? "Save changes" : "Send for approval"}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={lockedOpen} onOpenChange={setLockedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request a change</DialogTitle>
            <DialogDescription>
              Work email and working arrangement are managed by your clinic owner.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="field-stack">
              <Label htmlFor="pd-locked-email">Work email</Label>
              <Input
                id="pd-locked-email"
                value={lockedEmail}
                onChange={(e) => setLockedEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="field-stack">
              <Label htmlFor="pd-locked-arrangement">Working arrangement</Label>
              <select
                id="pd-locked-arrangement"
                value={lockedArrangement}
                onChange={(e) => setLockedArrangement(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">—</option>
                {WORKING_ARRANGEMENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-stack">
              <Label htmlFor="pd-locked-note">Note (optional)</Label>
              <Textarea
                id="pd-locked-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLockedOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={requestLocked.isPending || !lockedEmail.trim()}
              onClick={() => requestLocked.mutate()}
            >
              {requestLocked.isPending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
