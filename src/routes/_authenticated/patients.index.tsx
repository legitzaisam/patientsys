import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { listPatients, savePatient } from "@/lib/clinic.functions";
import { canSee } from "@/lib/access-catalogue";
import { can } from "@/lib/permissions";
import { JourneyBoard } from "@/components/patients/journey-board";
import { RecordsTab } from "@/components/patients/records-tab";
import {
  PATIENT_VIEWS,
  type PatientRow,
  type PatientView,
} from "@/components/patients/records-types";
import { SavePatient } from "@/lib/validation/schemas";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type PatientsTab = "records" | "board";

/**
 * Derived from the schema the savePatient server function validates against, so
 * the two cannot drift; this dialog only collects the subset a new record needs.
 */
const NewPatient = SavePatient.pick({
  first_name: true,
  last_name: true,
  title: true,
  email: true,
  phone: true,
  date_of_birth: true,
  allergies: true,
  medications: true,
});
type NewPatientValues = z.infer<typeof NewPatient>;

const EMPTY_PATIENT: NewPatientValues = {
  first_name: "",
  last_name: "",
  title: "",
  email: "",
  phone: "",
  date_of_birth: "",
  allergies: "",
  medications: "",
};

const TITLES = ["Mr", "Mrs", "Ms", "Miss", "Mx", "Dr", "Prof"];

export const Route = createFileRoute("/_authenticated/patients/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    view?: PatientView;
    q?: string;
    tab?: PatientsTab;
    page?: number;
    risk?: boolean;
    /** Records: practitioner filter, comma-separated ids, "me" or "all". */
    prac?: string;
    /** Records: the patient open in the drawer. */
    sel?: string;
    /** Journey board: highlighted triage tiles, comma-separated. */
    tiles?: string;
  } => {
    // No view in the URL means "the role's default" (practitioners land on My patients).
    const v = String(search?.["view"] ?? "");
    const parsed: {
      view?: PatientView;
      q?: string;
      tab?: PatientsTab;
      page?: number;
      risk?: boolean;
      prac?: string;
      sel?: string;
      tiles?: string;
    } = {};
    // ?risk=1 opens the journey board on its at-risk tiles (the dashboard's "overdue steps" chip).
    if (search?.["risk"] === true || search?.["risk"] === "1" || search?.["risk"] === 1) {
      parsed.risk = true;
    }
    if ((PATIENT_VIEWS as string[]).includes(v)) parsed.view = v as PatientView;
    if (typeof search?.["q"] === "string" && search["q"]) parsed.q = search["q"];
    if (typeof search?.["prac"] === "string" && search["prac"]) parsed.prac = search["prac"];
    if (typeof search?.["sel"] === "string" && search["sel"]) parsed.sel = search["sel"];
    if (typeof search?.["tiles"] === "string" && search["tiles"]) parsed.tiles = search["tiles"];
    const page = Number(search?.["page"]);
    if (Number.isInteger(page) && page > 1) parsed.page = page;
    const tab = String(search?.["tab"] ?? "records");
    if (tab === "board") parsed.tab = "board";
    if (tab === "metrics") (parsed as { tab?: string }).tab = "metrics";
    return parsed;
  },
  beforeLoad: ({ search }) => {
    if (String((search as { tab?: string }).tab ?? "") === "metrics") {
      throw redirect({ to: "/insights", search: { tab: "book" } });
    }
  },
  head: () => ({
    meta: [
      { title: "Patients — Aetheria" },
      {
        name: "description",
        content: "Search the clinic patient list with treatment history and outstanding paperwork.",
      },
      { property: "og:title", content: "Patients — Aetheria" },
      {
        property: "og:description",
        content: "Search patients, treatment history and outstanding paperwork.",
      },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const { data: identity } = useIdentity();
  const search = Route.useSearch();
  const { q, tab = "records", risk = false } = search;
  const fetchPatients = useServerFn(listPatients);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: patients } = useQuery({
    queryKey: ["patients"],
    queryFn: () => fetchPatients(),
    enabled: !!identity?.isStaff,
  });

  const patientForm = useForm<NewPatientValues>({
    resolver: zodResolver(NewPatient),
    defaultValues: EMPTY_PATIENT,
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const create = useMutation({
    mutationFn: useServerFn(savePatient),
    onSuccess: () => {
      toast.success("Patient added");
      setOpen(false);
      patientForm.reset(EMPTY_PATIENT);
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff)
    return <div className="p-12 text-sm text-muted-foreground">Staff access only.</div>;

  const canSendOffers = can(identity, "comms.send");
  const rows = (patients ?? []) as PatientRow[];
  const activePlans = rows.filter((p) => p.summary?.type === "skin_plan").length;

  return (
    <AppShell identity={identity}>
      <div className="page-header !mb-3">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">
            {tab === "records"
              ? `${rows.length} records`
              : `${activePlans} active skin plan${activePlans === 1 ? "" : "s"} across the journey.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi">
            {(
              [
                ...(canSee(identity, "patients-records")
                  ? [{ key: "records" as const, label: "Records" }]
                  : []),
                ...(canSee(identity, "patients-board")
                  ? [{ key: "board" as const, label: "Journey board" }]
                  : []),
              ] as { key: PatientsTab; label: string }[]
            ).map((t) => (
              <Link
                key={t.key}
                to="/patients"
                search={{
                  ...(t.key === "records"
                    ? {
                        ...(search.view ? { view: search.view } : {}),
                        ...(search.prac ? { prac: search.prac } : {}),
                        ...(q ? { q } : {}),
                      }
                    : {}),
                  ...(t.key !== "records"
                    ? { tab: t.key, ...(search.prac ? { prac: search.prac } : {}) }
                    : {}),
                }}
                data-qc={`patients-tab-${t.key}`}
                className={`flex h-7 cursor-pointer items-center rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors ${
                  tab === t.key
                    ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                    : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          {tab === "records" && canSee(identity, "patients-add") ? (
            <Button type="button" onClick={() => setOpen(true)} className="h-[34px]">
              New patient
            </Button>
          ) : null}
        </div>
      </div>

      {tab === "board" && (
        <JourneyBoard
          identity={identity}
          initialAtRiskOnly={risk}
          tiles={search.tiles}
          prac={search.prac}
        />
      )}
      {tab === "records" && (
        <RecordsTab
          identity={identity}
          patients={rows}
          search={{
            ...(search.view ? { view: search.view } : {}),
            ...(q ? { q } : {}),
            ...(search.page ? { page: search.page } : {}),
            ...(search.prac ? { prac: search.prac } : {}),
            ...(search.sel ? { sel: search.sel } : {}),
          }}
          canSendOffers={canSendOffers}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>New patient</DialogTitle>
          </DialogHeader>
          <Form {...patientForm}>
            <form
              id="new-patient"
              className="grid gap-4 sm:grid-cols-2"
              noValidate
              onSubmit={patientForm.handleSubmit((values) =>
                create.mutate({
                  data: {
                    first_name: values.first_name,
                    last_name: values.last_name,
                    title: values.title ?? "",
                    email: values.email ?? "",
                    phone: values.phone ?? "",
                    date_of_birth: values.date_of_birth ?? "",
                    allergies: values.allergies ?? "",
                    medications: values.medications ?? "",
                  },
                }),
              )}
            >
              <FormField
                control={patientForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <select
                        className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm"
                        {...field}
                        value={field.value ?? ""}
                      >
                        <option value="">—</option>
                        {TITLES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <PatientField control={patientForm.control} name="first_name" label="First name" />
              <PatientField control={patientForm.control} name="last_name" label="Last name" />
              <PatientField control={patientForm.control} name="email" label="Email" type="email" />
              <PatientField control={patientForm.control} name="phone" label="Phone" type="tel" />
              <PatientField
                control={patientForm.control}
                name="date_of_birth"
                label="Date of birth"
                type="date"
              />
              <FormField
                control={patientForm.control}
                name="allergies"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Allergies</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        className="rounded-xl"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={patientForm.control}
                name="medications"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Current medication</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        className="rounded-xl"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-patient" disabled={create.isPending}>
              Save patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function PatientField({
  control,
  name,
  label,
  type = "text",
}: {
  control: Control<NewPatientValues>;
  name: keyof NewPatientValues;
  label: string;
  type?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {type === "date" ? (
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <FormControl>
                <Input
                  type="date"
                  className="rounded-xl pl-[34px] pr-2 [&::-webkit-datetime-edit]:p-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
            </div>
          ) : (
            <FormControl>
              <Input type={type} className="rounded-xl" {...field} value={field.value ?? ""} />
            </FormControl>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
