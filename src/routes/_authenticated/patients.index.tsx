import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { listPatients, savePatient } from "@/lib/clinic.functions";
import { checkEmail } from "@/lib/email";
import { toastEmailError } from "@/lib/email-toast";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type SortColumn = "nextDue" | "paperwork" | "status";
type SortDirection = "asc" | "desc";
type PatientView = "all" | "active" | "inactive" | "due";

export const Route = createFileRoute("/_authenticated/patients/")({
  validateSearch: (search: Record<string, unknown>): { view?: PatientView; q?: string } => {
    const v = String(search?.["view"] ?? "all");
    const parsed: { view?: PatientView; q?: string } = {
      view: (["all", "active", "inactive", "due"].includes(v) ? v : "all") as PatientView,
    };
    if (typeof search?.["q"] === "string" && search["q"]) parsed.q = search["q"];
    return parsed;
  },
  head: () => ({
    meta: [
      { title: "Patients — Aetheria" },
      { name: "description", content: "Search the clinic patient list with treatment history and outstanding paperwork." },
      { property: "og:title", content: "Patients — Aetheria" },
      { property: "og:description", content: "Search patients, treatment history and outstanding paperwork." },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const { data: identity } = useIdentity();
  const { view = "all", q } = Route.useSearch();
  const fetchPatients = useServerFn(listPatients);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(q ?? "");
  const [dobSearch, setDobSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<{ column: SortColumn | null; direction: SortDirection }>({
    column: null,
    direction: "asc",
  });

  useEffect(() => {
    setSearch(q ?? "");
  }, [q]);

  const { data: patients } = useQuery({
    queryKey: ["patients"],
    queryFn: () => fetchPatients(),
    enabled: !!identity?.isStaff,
  });

  const create = useMutation({
    mutationFn: useServerFn(savePatient),
    onSuccess: () => {
      toast.success("Patient added");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff) return <div className="p-12 text-sm text-muted-foreground">Staff access only.</div>;

  const term = search.trim().toLowerCase();
  const dobTerm = dobSearch.trim();
  const dueCutoff = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const filtered = (patients ?? []).filter((p: any) => {
    const nameMatch = !term || `${p.first_name} ${p.last_name} ${p.reference ?? ""}`.toLowerCase().includes(term);
    const formattedDob = p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString("en-GB") : "";
    const dobMatch = !dobTerm || formattedDob.includes(dobTerm);
    const status = String(p.status ?? "").toLowerCase();
    let viewMatch = true;
    if (view === "active") viewMatch = status === "active";
    else if (view === "inactive") viewMatch = status !== "active";
    else if (view === "due") {
      const due = p.nextDue?.next_due_at ? new Date(p.nextDue.next_due_at).getTime() : null;
      viewMatch = due !== null && due <= dueCutoff;
    }
    return nameMatch && dobMatch && viewMatch;
  });

  const rows = [...filtered].sort((a: any, b: any) => {
    if (!sort.column) return 0;
    const dir = sort.direction === "asc" ? 1 : -1;

    if (sort.column === "nextDue") {
      const aDate = a.nextDue?.next_due_at ? new Date(a.nextDue.next_due_at).getTime() : Infinity;
      const bDate = b.nextDue?.next_due_at ? new Date(b.nextDue.next_due_at).getTime() : Infinity;
      if (aDate === bDate) return 0;
      return (aDate - bDate) * dir;
    }

    if (sort.column === "paperwork") {
      const aCount = a.outstandingDocuments ?? 0;
      const bCount = b.outstandingDocuments ?? 0;
      if (aCount === bCount) return 0;
      return (aCount - bCount) * dir;
    }

    if (sort.column === "status") {
      const priority: Record<string, number> = { active: 0, inactive: 1 };
      const aVal = priority[a.status?.toLowerCase()] ?? 2;
      const bVal = priority[b.status?.toLowerCase()] ?? 2;
      if (aVal === bVal) return a.status.localeCompare(b.status) * dir;
      return (aVal - bVal) * dir;
    }

    return 0;
  });

  return (
    <AppShell identity={identity}>
      <div className="page-header !mb-3">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} records</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input
            id="name-search"
            placeholder="Name or reference"
            aria-label="Search by name or reference"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-[34px] w-56 rounded-xl"
          />
          <div className="relative">
            <Input
              id="dob-search"
              type="text"
              placeholder="DD/MM/YYYY"
              aria-label="Search by date of birth"
              value={dobSearch}
              onChange={(e) => setDobSearch(e.target.value)}
              className="h-[34px] w-44 rounded-xl pr-9"
            />
            {dobSearch && (
              <button
                type="button"
                onClick={() => setDobSearch("")}
                aria-label="Clear date search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent-wash hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New patient</Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl">
              <DialogHeader>
                <DialogTitle className="font-serif">New patient</DialogTitle>
              </DialogHeader>
              <form
                id="new-patient"
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget as HTMLFormElement);
                  const rawEmail = String(f.get("email") ?? "");
                  let email = rawEmail.trim();
                  if (email) {
                    const check = checkEmail(email);
                    if (!check.ok) {
                      const formEl = e.currentTarget as HTMLFormElement;
                      toastEmailError(check, (suggestion) => {
                        const input = formEl.elements.namedItem("email") as HTMLInputElement | null;
                        if (input) {
                          input.value = suggestion;
                          input.dispatchEvent(new Event("input", { bubbles: true }));
                        }
                      });
                      return;
                    }
                    email = check.email;
                  }
                  create.mutate({
                    data: {
                      first_name: String(f.get("first_name")),
                      last_name: String(f.get("last_name")),
                      title: String(f.get("title") ?? ""),
                      email,
                      phone: String(f.get("phone") ?? ""),
                      date_of_birth: String(f.get("date_of_birth") ?? ""),
                      allergies: String(f.get("allergies") ?? ""),
                      medications: String(f.get("medications") ?? ""),
                    },
                  });
                }}
              >
                <div className="field-stack">
                  <Label htmlFor="title">Title</Label>
                  <select
                    id="title"
                    name="title"
                    className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm"
                    defaultValue=""
                  >
                    <option value="">—</option>
                    {["Mr", "Mrs", "Ms", "Miss", "Mx", "Dr", "Prof"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <Field name="first_name" label="First name" required />
                <Field name="last_name" label="Last name" required />
                <Field name="email" label="Email" type="email" />
                <Field name="phone" label="Phone" />
                <Field name="date_of_birth" label="Date of birth" type="date" />
                <div className="sm:col-span-2 field-stack">
                  <Label htmlFor="allergies">Allergies</Label>
                  <Textarea id="allergies" name="allergies" rows={2} className="rounded-xl" />
                </div>
                <div className="sm:col-span-2 field-stack">
                  <Label htmlFor="medications">Current medication</Label>
                  <Textarea id="medications" name="medications" rows={2} className="rounded-xl" />
                </div>
              </form>
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
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {([
          { key: "all", label: "All" },
          { key: "active", label: "Active" },
          { key: "inactive", label: "Inactive" },
          { key: "due", label: "Treatments due" },
        ] as { key: PatientView; label: string }[]).map((f) => (
          <Link
            key={f.key}
            to="/patients"
            search={{ view: f.key, ...(q ? { q } : {}) }}
            className={`rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors ${
              view === f.key
                ? "border-transparent bg-accent-soft text-accent-ink shadow-inset-hi"
                : "border-edge bg-glass-2 text-ink-2 shadow-inset-hi hover:border-accent-line hover:bg-accent-wash hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden rounded-2xl p-0">
        <table className="glass-table w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Last treatment</th>
              <th className="px-4 py-3">Next treatment</th>
              <SortHeader column="nextDue" label="Next due" sort={sort} setSort={setSort} />
              <SortHeader column="paperwork" label="Paperwork" sort={sort} setSort={setSort} />
              <SortHeader column="status" label="Status" sort={sort} setSort={setSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((p: any) => (
              <tr key={p.id} className="hover:bg-glass-2">
                <td className="px-4 py-3">
                  <Link to="/patients/$id" params={{ id: p.id }} className="text-foreground hover:text-accent-ink">
                    {p.last_name}, {p.title ? `${p.title} ` : ""}
                    {p.first_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString("en-GB") : ""}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.lastTreatment
                    ? `${p.lastTreatment.name} · ${new Date(p.lastTreatment.performed_at).toLocaleDateString("en-GB")}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.nextAppointment
                    ? `${p.nextAppointment.treatment_name}${
                        p.nextAppointment.treatment_number ? ` #${p.nextAppointment.treatment_number}` : ""
                      }${
                        p.nextDue?.next_due_at
                          ? ""
                          : ` · ${new Date(p.nextAppointment.starts_at).toLocaleDateString("en-GB")}`
                      }`
                    : "No upcoming treatment"}
                </td>
                <td className="w-[1%] whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {p.nextDue?.next_due_at
                    ? new Date(p.nextDue.next_due_at).toLocaleDateString("en-GB")
                    : "—"}
                </td>
                <td className="w-[1%] whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {p.outstandingDocuments > 0 ? (
                    <Badge variant="outline" className="rounded-xl border-warning text-warning-ink">
                      {p.outstandingDocuments} outstanding
                    </Badge>
                  ) : (
                    <span>Complete</span>
                  )}
                </td>
                <td className="w-[1%] whitespace-nowrap px-4 py-3 text-muted-foreground">
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No patients yet — add your first record.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="field-stack">
      <Label htmlFor={name}>{label}</Label>
      {type === "date" ? (
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={name}
            name={name}
            type="date"
            required={required}
            className="rounded-xl pl-[34px] pr-2 [&::-webkit-datetime-edit]:p-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
          />
        </div>
      ) : (
        <Input id={name} name={name} type={type} required={required} className="rounded-xl" />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized === "active") {
    return (
      <Badge variant="success">
        Active
      </Badge>
    );
  }
  if (normalized === "inactive") {
    return (
      <Badge variant="destructive">
        Inactive
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-full capitalize text-muted-foreground">
      {status}
    </Badge>
  );
}

function SortHeader({
  column,
  label,
  sort,
  setSort,
}: {
  column: SortColumn;
  label: string;
  sort: { column: SortColumn | null; direction: SortDirection };
  setSort: (s: { column: SortColumn | null; direction: SortDirection }) => void;
}) {
  const active = sort.column === column;
  const Icon = active ? (sort.direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;

  return (
    <th className="w-[1%] whitespace-nowrap px-4 py-3">
      <button
        type="button"
        onClick={() =>
          setSort({
            column,
            direction: active && sort.direction === "asc" ? "desc" : "asc",
          })
        }
        className="flex items-center gap-1 font-normal tracking-[0.02em] text-muted-foreground transition-colors hover:text-foreground"
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? "text-foreground" : "text-muted-foreground/50"}`} />
      </button>
    </th>
  );
}