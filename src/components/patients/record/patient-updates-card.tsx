import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptHistoryUpdate } from "@/lib/clinic.functions";
import {
  isPendingHistory,
  pendingHistoryFields,
  shortDate,
  type HistoryVersionLike,
} from "@/lib/patients/record-overview";

/**
 * Medical history changes the patient made in their portal and nobody has
 * accepted yet, each as labelled fields with Accept into record. Nothing
 * merges into the header until a clinician accepts it; the row then reads
 * "✓ Accepted" until the list refreshes.
 */
export function PatientUpdatesCard({
  history,
  patient,
  patientId,
  canAccept,
  onBackToOverview,
}: {
  history: HistoryVersionLike[];
  patient: { allergies?: string | null; medications?: string | null; conditions?: string | null };
  patientId: string;
  canAccept: boolean;
  onBackToOverview: () => void;
}) {
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  // The version being accepted, so the row can read "✓ Accepted" the moment the call lands.
  const accepting = useRef<string | null>(null);
  const accept = useMutation({
    mutationFn: useServerFn(acceptHistoryUpdate),
    onSuccess: () => {
      const id = accepting.current;
      if (id) setAccepted((s) => new Set(s).add(id));
      toast.success("Accepted. The record's allergies, medication and conditions are updated.");
      void queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const acceptVersion = (versionId: string) => {
    accepting.current = versionId;
    accept.mutate({ data: { id: versionId, patient_id: patientId } });
  };

  // Accepted rows stay in view as "✓ Accepted" until the reader leaves the record.
  const pending = history.filter((v) => isPendingHistory(v) || accepted.has(v.id));
  if (pending.length === 0) return null;
  const latest = pending[0]!;

  return (
    <section className="glass-card flex flex-col gap-3 px-6 py-[22px]" data-qc="patient-updates">
      <div>
        <h2 className="text-[17px] font-medium text-foreground">Updates from the patient</h2>
        <p className="mt-0.5 text-xs text-ink-2">
          Added in the portal on {shortDate(latest.created_at)}. Nothing changes in the record until
          a clinician accepts it.
        </p>
      </div>
      {pending.map((version) => {
        const done = accepted.has(version.id) || !isPendingHistory(version);
        // Once accepted the record matches the update, so compare against nothing to keep the fields.
        const fields = pendingHistoryFields(version, done ? {} : patient);
        return (
          <div
            key={version.id}
            className="flex flex-wrap items-center gap-3 rounded-[14px] bg-[rgba(224,213,248,0.28)] px-3.5 py-3"
            data-qc="patient-update"
            data-id={version.id}
            data-accepted={done ? "true" : "false"}
          >
            {fields.length === 0 ? (
              <div className="min-w-[200px] flex-1 text-sm text-foreground">
                {version.summary ?? "Updated their medical information"}
                <span className="block text-xs text-ink-2">
                  Nothing here changes the allergies, medication or conditions on file.
                </span>
              </div>
            ) : (
              fields.map((f) => (
                <div
                  key={f.key}
                  className="min-w-[200px] flex-1"
                  data-qc="patient-update-field"
                  data-key={f.key}
                >
                  <div className="text-[11.5px] font-semibold text-warning-ink">{f.label}</div>
                  <div className="text-sm text-foreground">{f.value}</div>
                </div>
              ))
            )}
            {done ? (
              <span
                className="text-[12.5px] font-semibold text-success-ink"
                data-qc="patient-update-accepted"
              >
                ✓ Accepted
              </span>
            ) : canAccept ? (
              <Button
                type="button"
                className="h-auto rounded-full px-[13px] py-1.5 text-xs"
                disabled={accept.isPending}
                onClick={() => acceptVersion(version.id)}
                data-qc="patient-update-accept"
              >
                Accept into record
              </Button>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        className="self-start cursor-pointer text-xs font-semibold text-accent-ink hover:underline"
        onClick={onBackToOverview}
        data-qc="patient-updates-back"
      >
        ← Back to Overview
      </button>
    </section>
  );
}
