import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RoadmapStep } from "@/components/patients/record/skin-plan-roadmap";
import { updatePlanMilestoneDetails } from "@/lib/clinic.functions";

type StepStatus = "upcoming" | "current" | "done" | "skipped";

const STATUS_OPTIONS: { value: StepStatus; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "current", label: "In progress" },
  { value: "done", label: "Completed" },
  { value: "skipped", label: "Skipped" },
];

/**
 * Edit one roadmap step: title, due date, the note the patient sees under it,
 * and its status. Saves through updatePlanMilestoneDetails, so a status
 * change promotes the next step and closes the plan the same way the
 * treatment form does.
 */
export function EditStepDialog({
  step,
  patientId,
  onClose,
}: {
  step: RoadmapStep | null;
  patientId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: useServerFn(updatePlanMilestoneDetails),
    onSuccess: () => {
      toast.success("Step updated. The patient's Timeline shows the change.");
      void queryClient.invalidateQueries({ queryKey: ["patient-plan", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
      void queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={Boolean(step)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[calc(calc(100*var(--app-dvh))-2rem)] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>Edit step</DialogTitle>
        </DialogHeader>
        {step ? (
          <form
            id="edit-step-form"
            key={step.id}
            className="space-y-4"
            data-qc="edit-step-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const dueDate = String(f.get("due_date") ?? "");
              const detail = String(f.get("detail") ?? "").trim();
              save.mutate({
                data: {
                  id: step.id,
                  title: String(f.get("title") ?? "").trim(),
                  ...(dueDate ? { due_date: dueDate } : {}),
                  ...(detail ? { detail } : {}),
                  status: String(f.get("status")) as StepStatus,
                },
              });
            }}
          >
            <div className="field-stack">
              <Label htmlFor="edit-step-title">Title</Label>
              <Input
                id="edit-step-title"
                name="title"
                required
                maxLength={200}
                defaultValue={step.title}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field-stack">
                <Label htmlFor="edit-step-due">Due date</Label>
                <Input
                  id="edit-step-due"
                  name="due_date"
                  type="date"
                  defaultValue={step.date ?? ""}
                  className="rounded-xl"
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="edit-step-status">Status</Label>
                <select
                  id="edit-step-status"
                  name="status"
                  defaultValue={step.status}
                  className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 px-3 text-sm shadow-inset-hi"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field-stack">
              <Label htmlFor="edit-step-detail">Detail</Label>
              <Textarea
                id="edit-step-detail"
                name="detail"
                rows={3}
                maxLength={2000}
                defaultValue={step.detail ?? ""}
                placeholder="What the patient sees under this step on their Timeline."
                className="rounded-xl"
              />
            </div>
          </form>
        ) : null}
        <DialogFooter>
          <Button
            type="submit"
            form="edit-step-form"
            disabled={save.isPending}
            data-qc="edit-step-save"
          >
            {save.isPending ? "Saving…" : "Save step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
