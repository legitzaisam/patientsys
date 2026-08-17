import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, Plus, UserPlus } from "lucide-react";
import { saveAppointment, savePatient } from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function toLocalTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function QuickAddAppointment({
  patients,
  practitioners,
  catalogue,
  date,
  defaultStart,
  defaultPractitionerId,
  open,
  onOpenChange,
  align = "start",
  children,
}: {
  patients: any[];
  practitioners: any[];
  catalogue: any[];
  date: Date;
  defaultStart?: Date | undefined;
  defaultPractitionerId?: string | undefined;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [uncontrolled, setUncontrolled] = useState(false);
  const isOpen = open ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  const [patientId, setPatientId] = useState("");
  const [newPatient, setNewPatient] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [catalogueId, setCatalogueId] = useState("");
  const [practitionerId, setPractitionerId] = useState(defaultPractitionerId ?? "");
  const [time, setTime] = useState(defaultStart ? toLocalTime(defaultStart) : "09:00");
  const [duration, setDuration] = useState("30");

  useEffect(() => {
    if (!isOpen) return;
    if (defaultStart) setTime(toLocalTime(defaultStart));
    if (defaultPractitionerId) setPractitionerId(defaultPractitionerId);
  }, [isOpen, defaultStart, defaultPractitionerId]);

  useEffect(() => {
    if (!catalogueId && catalogue.length) setCatalogueId(catalogue[0].id);
    if (!practitionerId && practitioners.length) setPractitionerId(practitioners[0].id);
  }, [catalogue, practitioners, catalogueId, practitionerId]);

  const addPatient = useMutation({
    mutationFn: useServerFn(savePatient),
    onError: (e: Error) => toast.error(e.message),
  });
  const book = useMutation({
    mutationFn: useServerFn(saveAppointment),
    onSuccess: () => {
      toast.success("Appointment booked", {
        description: "Confirmation sent to the patient and the practitioner has been notified.",
      });
      setOpen(false);
      setNewPatient(false);
      setFirstName("");
      setLastName("");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let id = patientId;
    if (newPatient) {
      if (!firstName.trim() || !lastName.trim()) {
        toast.error("Enter the new patient's first and last name");
        return;
      }
      try {
        const created = await addPatient.mutateAsync({
          data: { first_name: firstName.trim(), last_name: lastName.trim() },
        });
        id = created.id;
        queryClient.invalidateQueries({ queryKey: ["patients"] });
      } catch {
        return;
      }
    }
    if (!id) {
      toast.error("Choose a patient");
      return;
    }
    const [h, m] = time.split(":").map(Number);
    const start = new Date(date);
    start.setHours(h ?? 9, m ?? 0, 0, 0);
    const item = catalogue.find((c) => c.id === catalogueId);
    book.mutate({
      data: {
        patient_id: id,
        practitioner_id: practitionerId,
        catalogue_id: catalogueId,
        treatment_name: item?.name ?? "Treatment",
        treatment_number: 1,
        starts_at: start.toISOString(),
        duration_minutes: Number(duration) || 30,
        price: Number(item?.price ?? 0),
        payment_status: "unpaid",
      },
    });
  };

  const field = "h-9 rounded-xl text-xs";

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-80 rounded-2xl p-4">
        <form className="space-y-3" onSubmit={submit}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Quick add</p>
            <button
              type="button"
              onClick={() => setNewPatient((v) => !v)}
              className="inline-flex items-center gap-1 text-2xs text-accent-ink hover:underline"
            >
              <UserPlus className="h-3 w-3" />
              {newPatient ? "Existing patient" : "New patient"}
            </button>
          </div>

          {newPatient ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                className={field}
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                className={field}
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Patient</Label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="h-9 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-xs"
              >
                <option value="">Choose patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Treatment</Label>
            <select
              value={catalogueId}
              onChange={(e) => setCatalogueId(e.target.value)}
              className="h-9 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-xs"
            >
              {catalogue.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Time</Label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={`${field} pl-[34px]`}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Minutes</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={field}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Practitioner</Label>
            <select
              value={practitionerId}
              onChange={(e) => setPractitionerId(e.target.value)}
              className="h-9 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-xs"
            >
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || "Unnamed"}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            className="h-9 w-full text-xs"
            disabled={book.isPending || addPatient.isPending}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Book appointment
          </Button>
          <p className="text-center text-2xs text-muted-foreground">Press Esc to dismiss</p>
        </form>
      </PopoverContent>
    </Popover>
  );
}