import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Textarea } from "@/components/ui/textarea";
import { createRecallTask, listTeam, logRetentionOutreach } from "@/lib/clinic.functions";

const ROLE_LABEL: Record<string, string> = {
  owner: "Manager",
  practitioner: "Practitioner",
  front_desk: "Receptionist",
};

/**
 * Manager-only hover action: drop a recall task to the practitioner and/or
 * the front desk so they know to contact the patient.
 */
export function StaffTaskHoverCard({
  children,
  patientId,
  patientName,
  practitionerId,
  practitionerName,
  treatment,
}: {
  children: React.ReactNode;
  patientId: string;
  patientName: string;
  practitionerId?: string | null;
  practitionerName?: string | null;
  treatment?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const queryClient = useQueryClient();

  const fetchTeam = useServerFn(listTeam);
  const createTask = useServerFn(createRecallTask);
  const logOutreach = useServerFn(logRetentionOutreach);
  const { data: team } = useQuery({
    queryKey: ["team", "recall-task"],
    queryFn: () => fetchTeam(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const recipients = useMemo(
    () => (team ?? []).filter((m: any) => m.role === "practitioner" || m.role === "front_desk"),
    [team],
  );

  // Default: the patient's own practitioner AND the front desk are ticked, so
  // both sides get the recall and can see each other's progress.
  const defaults = useMemo(() => {
    const ids = recipients
      .filter((m: any) => m.role === "front_desk")
      .map((m: any) => m.userId as string);
    if (practitionerId && recipients.some((m: any) => m.userId === practitionerId)) {
      ids.unshift(practitionerId);
    }
    return ids;
  }, [recipients, practitionerId]);

  const checked = touched ? selected : defaults;

  const toggle = (id: string) => {
    setTouched(true);
    setSelected((prev) =>
      (touched ? prev : checked).includes(id)
        ? (touched ? prev : checked).filter((x) => x !== id)
        : [...(touched ? prev : checked), id],
    );
  };

  const send = useMutation({
    mutationFn: async (vars: { recipients: { id: string; label: string }[]; note: string }) => {
      await createTask({
        data: { patient_id: patientId, recipients: vars.recipients, note: vars.note },
      });
      await logOutreach({
        data: {
          patient_id: patientId,
          channel: "internal-task",
          note: `To ${vars.recipients.map((r) => r.label).join(", ")}: ${vars.note}`,
        },
      });
    },
    onSuccess: () => {
      toast.success("Recall task sent to the team");
      queryClient.invalidateQueries({ queryKey: ["recall-tasks", patientId] });
      setOpen(false);
      setNote("");
      setTouched(false);
      setSelected([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const picked = recipients
    .filter((m: any) => checked.includes(m.userId))
    .map((m: any) => ({ id: m.userId as string, label: (m.fullName || m.email) as string }));

  const submit = () => {
    if (!picked.length) {
      toast.error("Pick at least one team member");
      return;
    }
    const body =
      note.trim() ||
      `Please contact ${patientName} to rebook${treatment ? ` their ${treatment}` : ""}.`;
    send.mutate({ recipients: picked, note: body });
  };

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={150} closeDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 rounded-2xl p-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-foreground">Ask the team to recall</p>
          <p className="text-xs text-muted-foreground">
            {patientName}
            {practitionerName ? ` · usually seen by ${practitionerName}` : ""}
          </p>
        </div>

        <div className="mb-3 space-y-2">
          {recipients.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No practitioners or receptionists yet — add them under Team.
            </p>
          )}
          {recipients.map((m: any) => (
            <label key={m.userId} className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={checked.includes(m.userId)}
                onCheckedChange={() => toggle(m.userId)}
              />
              <UserRound className="h-3.5 w-3.5 text-ink-3" />
              <span className="text-foreground">{m.fullName || m.email}</span>
              <span className="text-2xs text-muted-foreground">{ROLE_LABEL[m.role] ?? m.role}</span>
            </label>
          ))}
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={`Please contact ${patientName} to rebook${treatment ? ` their ${treatment}` : ""}.`}
          className="mb-3 rounded-xl text-xs"
        />

        <p className="mb-3 text-2xs text-muted-foreground">
          Everyone ticked sees the same task. When one of them marks it off, it updates for the
          others too, so the patient is only contacted once.
        </p>

        <Button
          size="sm"
          className="w-full "
          disabled={send.isPending}
          onClick={submit}
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {send.isPending ? "Sending…" : "Send recall task"}
        </Button>
      </HoverCardContent>
    </HoverCard>
  );
}
