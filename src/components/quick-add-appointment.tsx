import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar, Check, ChevronsUpDown, Clock, GripVertical, Plus, Search, UserPlus } from "lucide-react";
import { saveAppointment, savePatient } from "@/lib/clinic.functions";
import { durationForCatalogueItem } from "@/lib/treatment-duration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function toLocalTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function patientLabel(p: { first_name?: string; last_name?: string }) {
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

function PatientCombobox({
  patients,
  value,
  onChange,
  fieldClass,
}: {
  patients: any[];
  value: string;
  onChange: (id: string) => void;
  fieldClass: string;
}) {
  const selected = patients.find((p) => p.id === value);
  const [query, setQuery] = useState(selected ? patientLabel(selected) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const browsingSelected = Boolean(
    selected && query.trim().toLowerCase() === patientLabel(selected).toLowerCase(),
  );
  const term = browsingSelected ? "" : query.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = term
      ? patients.filter((p) =>
          `${p.first_name} ${p.last_name} ${p.reference ?? ""} ${p.email ?? ""} ${p.phone ?? ""}`
            .toLowerCase()
            .includes(term),
        )
      : patients;
    return list.slice(0, 80);
  }, [patients, term]);

  useEffect(() => {
    if (open) return;
    setQuery(selected ? patientLabel(selected) : "");
  }, [open, selected]);

  useEffect(() => {
    setActive(0);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function pick(p: any) {
    onChange(p.id);
    setQuery(patientLabel(p));
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label="Search patient"
        autoComplete="off"
        placeholder="Search patient…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            const hit = matches[active];
            if (hit) pick(hit);
          }
        }}
        className={`${fieldClass} pl-[34px] pr-8`}
      />
      <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      {open && (
        <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-edge bg-popover p-1 shadow-glass">
          {matches.length === 0 ? (
            <p className="px-2 py-2 text-center text-2xs text-muted-foreground">No matching patients</p>
          ) : (
            matches.map((p, i) => {
              const chosen = p.id === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                    i === active ? "bg-accent-wash text-foreground" : "text-foreground"
                  }`}
                >
                  <Check className={`h-3 w-3 shrink-0 ${chosen ? "opacity-100" : "opacity-0"}`} />
                  <span className="min-w-0 flex-1 truncate">
                    {patientLabel(p)}
                    {p.reference ? (
                      <span className="ml-1 text-muted-foreground">· {p.reference}</span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
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
  title = "Quick add",
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
  title?: string;
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
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [catalogueId, setCatalogueId] = useState("");
  const [practitionerId, setPractitionerId] = useState(defaultPractitionerId ?? "");
  const [time, setTime] = useState(defaultStart ? toLocalTime(defaultStart) : "09:00");
  const [day, setDay] = useState(toLocalDate(defaultStart ?? date));
  const [duration, setDuration] = useState("30");
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const from = defaultStart ?? date;
    setDay(toLocalDate(from));
    if (defaultStart) setTime(toLocalTime(defaultStart));
    if (defaultPractitionerId) setPractitionerId(defaultPractitionerId);
  }, [isOpen, date, defaultStart, defaultPractitionerId]);

  useEffect(() => {
    if (!catalogueId && catalogue.length) setCatalogueId(catalogue[0].id);
    if (!practitionerId && practitioners.length) setPractitionerId(practitioners[0].id);
  }, [catalogue, practitioners, catalogueId, practitionerId]);

  useEffect(() => {
    const item = catalogue.find((c) => c.id === catalogueId);
    if (!item) return;
    setDuration(String(durationForCatalogueItem(item)));
  }, [catalogue, catalogueId]);

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
      setDob("");
      setEmail("");
      setPhone("");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-week"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-diary-count"] });
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
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            date_of_birth: dob || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
          },
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) {
      toast.error("Choose a date and time");
      return;
    }
    const [h, m] = time.split(":").map(Number);
    const [year, month, dayNum] = day.split("-").map(Number);
    const start = new Date(year, month - 1, dayNum, h, m, 0, 0);
    if (Number.isNaN(start.getTime())) {
      toast.error("Choose a date and time");
      return;
    }
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

  useEffect(() => {
    if (isOpen) return;
    setOffset({ x: 0, y: 0 });
  }, [isOpen]);

  function onDragHandleDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origX: offset.x,
      origY: offset.y,
    };
    document.body.classList.add("select-none", "cursor-grabbing");

    function onMove(moveEvent: globalThis.PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      setOffset({
        x: drag.origX + (moveEvent.clientX - drag.startX),
        y: drag.origY + (moveEvent.clientY - drag.startY),
      });
    }

    function onUp() {
      dragRef.current = null;
      document.body.classList.remove("select-none", "cursor-grabbing");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const field = "h-9 rounded-xl text-xs";

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[480px] max-w-[calc(100vw-2rem)] rounded-2xl p-4"
        style={{ translate: `${offset.x}px ${offset.y}px` }}
      >
        <form className="space-y-3" onSubmit={submit}>
          <div
            className="flex cursor-grab items-center justify-between active:cursor-grabbing"
            onPointerDown={onDragHandleDown}
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {title}
            </p>
            <button
              type="button"
              onClick={() => setNewPatient((v) => !v)}
              className="inline-flex items-center gap-1 text-2xs text-accent-ink hover:underline"
            >
              <UserPlus className="h-3 w-3" />
              {newPatient ? "Existing patient" : "New patient"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-3">
            {newPatient ? (
              <>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Patient name</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      className={field}
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      aria-label="First name"
                    />
                    <Input
                      className={field}
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      aria-label="Last name"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Date of birth</Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      aria-label="Date of birth"
                      className={`${field} pl-[34px] pr-2 [&::-webkit-datetime-edit]:p-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    className={field}
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label="Email"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Phone</Label>
                  <Input
                    type="tel"
                    className={field}
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-label="Phone"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Patient</Label>
                <PatientCombobox
                  patients={patients}
                  value={patientId}
                  onChange={setPatientId}
                  fieldClass={field}
                />
              </div>
            )}

            <div className={`space-y-1.5 ${newPatient ? "col-span-2" : ""}`}>
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

            <div className="col-span-2 grid grid-cols-[1fr_1fr_5.5rem] gap-2">
              <div className="space-y-1.5">
                <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Date</Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className={`${field} pl-[34px] pr-2 [&::-webkit-datetime-edit]:p-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Time</Label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={`${field} pl-[34px] pr-2 [&::-webkit-datetime-edit]:p-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-2xs tracking-[0.02em] text-muted-foreground">Mins</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={`${field} px-2 text-center`}
                />
              </div>
            </div>

            <div className="col-span-2 space-y-1.5">
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