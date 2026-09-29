import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PaginationBar } from "@/components/pagination-bar";
import { SendOfferDialog } from "@/components/offers/send-offer-dialog";
import { SendRecallDialog } from "@/components/retention/send-recall-dialog";
import { QuickAddAppointment } from "@/components/quick-add-appointment";
import { AssignTaskDialog } from "@/components/tasks/assign-task-dialog";
import { getCatalogue, getClinicDetails, listPractitioners } from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { useTasksLiveSync } from "@/lib/use-tasks-sync";
import { shortName } from "@/lib/staff-lane";
import { RecordsFilterBar, type PractitionerChip } from "@/components/patients/records-filter-bar";
import { RecordsTable } from "@/components/patients/records-table";
import { PatientDrawer, type DrawerAction } from "@/components/patients/patient-drawer";
import { type PatientRow, type PatientView } from "@/components/patients/records-types";

const PAGE_SIZE = 25;

type Identity = {
  userId: string;
  isManager: boolean;
  isOwner?: boolean;
  isAdmin?: boolean;
  roles: string[];
  permissions?: string[];
  treatsPatients?: boolean;
};

export type RecordsSearch = {
  view?: PatientView;
  q?: string;
  page?: number;
  prac?: string;
  sel?: string;
};

/**
 * Patients → Records. The table is for seeing: who they are, what happened
 * last, what is next, and whether a task is open. The drawer says what to do
 * next and hands off to the flows that do it. Filters live in the URL
 * (`prac`, `sel`, `q`, `page`, and a deep-linked `view`).
 */
export function RecordsTab({
  identity,
  patients,
  search,
  canSendOffers,
}: {
  identity: Identity;
  patients: PatientRow[];
  search: RecordsSearch;
  canSendOffers: boolean;
}) {
  const navigate = useNavigate();
  useTasksLiveSync();
  // Below the xl breakpoint the drawer is a right-hand sheet instead of a side column.
  const narrow = useIsMobile(1280);
  // One clock per render of the list, so every row and the drawer agree on "today".
  const now = useMemo(() => new Date(), []);
  const ownBook = !identity.isManager && identity.roles.includes("practitioner");
  const treats = Boolean(identity.treatsPatients) || ownBook;

  // ---------------------------------------------------------------- URL state
  const view: PatientView | null =
    search.view && search.view !== "all" && search.view !== "mine" ? search.view : null;
  const pracParam =
    search.prac ??
    (search.view === "mine" || (!search.view && !search.prac && ownBook) ? "me" : "");
  const mineActive = pracParam === "me";
  // `all` is how a practitioner's own book opts out of its default scope.
  const selectedPracs = useMemo(
    () =>
      mineActive
        ? [identity.userId]
        : pracParam === "all"
          ? []
          : pracParam.split(",").filter(Boolean),
    [mineActive, pracParam, identity.userId],
  );
  const q = search.q ?? "";
  const [searchText, setSearchText] = useState(q);
  useEffect(() => setSearchText(q), [q]);

  type SearchPatch = { [K in keyof RecordsSearch]?: RecordsSearch[K] | undefined };
  const go = (patch: SearchPatch, opts: { replace?: boolean } = {}) => {
    const next: Record<string, unknown> = {
      ...(search.view ? { view: search.view } : {}),
      ...(search.q ? { q: search.q } : {}),
      ...(search.prac ? { prac: search.prac } : {}),
      ...(search.sel ? { sel: search.sel } : {}),
      ...(search.page && search.page > 1 ? { page: search.page } : {}),
      ...patch,
    };
    for (const k of Object.keys(next))
      if (next[k] === undefined || next[k] === "" || next[k] === null) delete next[k];
    void navigate({ to: "/patients", search: next as never, replace: opts.replace ?? false });
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchText.trim() !== q)
        go({ q: searchText.trim() || undefined, page: undefined }, { replace: true });
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  // ---------------------------------------------------------------- filtering
  const term = q.trim().toLowerCase();
  const searched = useMemo(
    () =>
      patients.filter(
        (p) =>
          !term ||
          `${p.first_name} ${p.last_name} ${p.reference ?? ""}`.toLowerCase().includes(term),
      ),
    [patients, term],
  );
  const inView = (p: PatientRow, v: PatientView | null) => {
    if (!v) return true;
    const status = String(p.status ?? "").toLowerCase();
    if (v === "active") return status === "active";
    if (v === "inactive") return status !== "active";
    if (v === "due") return p.dueState === "overdue" || p.dueState === "due_soon";
    if (v === "nobooking") return p.dueState !== "booked";
    return true;
  };
  const viewed = useMemo(() => searched.filter((p) => inView(p, view)), [searched, view]);
  const practitionerOf = (p: PatientRow) =>
    p.summary?.primaryPractitionerId ?? p.practitionerIds[0] ?? null;
  const filtered = useMemo(
    () =>
      selectedPracs.length
        ? viewed.filter((p) => selectedPracs.includes(practitionerOf(p) ?? ""))
        : viewed,
    [viewed, selectedPracs],
  );

  const chips: PractitionerChip[] = useMemo(() => {
    const counts = new Map<string, PractitionerChip>();
    for (const p of viewed) {
      const id = practitionerOf(p);
      if (!id) continue;
      const name = p.summary?.primaryPractitionerName ?? p.practitioners[0] ?? "Practitioner";
      const chip = counts.get(id) ?? { id, name, count: 0 };
      chip.count += 1;
      counts.set(id, chip);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [viewed]);

  // ---------------------------------------------------------------- paging + selection
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // A deep link to a patient (the board's pills, the dashboard) lands on their page.
  const selIndex = search.sel && !search.page ? filtered.findIndex((p) => p.id === search.sel) : -1;
  const page = Math.min(
    Math.max(1, search.page ?? (selIndex >= 0 ? Math.floor(selIndex / PAGE_SIZE) + 1 : 1)),
    pageCount,
  );
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // The drawer follows the URL's `sel`; when the filter hides it, the first visible row stands in.
  const selectedId = pageRows.some((p) => p.id === search.sel)
    ? search.sel!
    : (pageRows[0]?.id ?? null);
  const selected = pageRows.find((p) => p.id === selectedId) ?? null;
  const [sheetOpen, setSheetOpen] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => {
    setChecked(new Set());
  }, [view, q, pracParam]);
  const [offerOpen, setOfferOpen] = useState(false);
  const allChecked = filtered.length > 0 && filtered.every((p) => checked.has(p.id));

  // ---------------------------------------------------------------- actions
  const [assignFor, setAssignFor] = useState<PatientRow | null>(null);
  const [booking, setBooking] = useState<PatientRow | null>(null);
  const [recallFor, setRecallFor] = useState<PatientRow | null>(null);
  const [offerFor, setOfferFor] = useState<PatientRow | null>(null);
  const fetchPractitioners = useServerFn(listPractitioners);
  const { data: practitioners } = useQuery({
    queryKey: ["practitioners"],
    queryFn: () => fetchPractitioners(),
  });
  const fetchCatalogue = useServerFn(getCatalogue);
  const { data: catalogue } = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => fetchCatalogue(),
    enabled: !!booking,
  });
  const fetchClinic = useServerFn(getClinicDetails);
  const { data: clinic } = useQuery({
    queryKey: ["clinic-details"],
    queryFn: () => fetchClinic(),
    enabled: !!recallFor,
  });

  const onAction = (action: DrawerAction, p: PatientRow) => {
    switch (action) {
      case "book":
        setBooking(p);
        return;
      case "send_booking_link":
      case "send_form_reminder":
      case "message":
        setRecallFor(p);
        return;
      case "call":
        if (p.phone) window.location.href = `tel:${p.phone.replace(/\s+/g, "")}`;
        else setRecallFor(p);
        return;
      case "approve_offer":
        setOfferFor(p);
        return;
      case "open_task":
        void navigate({
          to: "/tasks" as never,
          search: { task: p.summary?.openTasks[0]?.id } as never,
        });
        return;
      case "review_photos":
        void navigate({
          to: "/patients/$id",
          params: { id: p.id },
          search: { tab: "photos" } as never,
        });
        return;
      case "reactivate":
        void navigate({ to: "/patients/$id", params: { id: p.id } });
        return;
      case "assign":
        setAssignFor(p);
        return;
    }
  };

  const summaryText = selectedPracs.length
    ? `${
        chips
          .filter((c) => selectedPracs.includes(c.id))
          .map((c) => shortName(c.name))
          .join(", ") || "You"
      } · ${filtered.length} patient${filtered.length === 1 ? "" : "s"}`
    : `All practitioners · ${filtered.length} patient${filtered.length === 1 ? "" : "s"}`;

  const drawer = selected ? (
    <PatientDrawer
      patient={selected}
      now={now}
      onAction={onAction}
      onAssignTask={(p) => setAssignFor(p)}
      onOpenTask={(taskId) =>
        void navigate({ to: "/tasks" as never, search: { task: taskId } as never })
      }
    />
  ) : null;

  return (
    <>
      <RecordsFilterBar
        practitioners={chips}
        selected={selectedPracs}
        onToggle={(id) => {
          const base = mineActive ? [identity.userId] : selectedPracs;
          const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
          go({
            prac: next.length ? next.join(",") : ownBook ? "all" : undefined,
            view: search.view === "mine" ? undefined : search.view,
            page: undefined,
          });
        }}
        showMine={treats}
        mineActive={mineActive}
        onMine={() =>
          go({
            prac: mineActive ? (ownBook ? "all" : undefined) : "me",
            view: search.view === "mine" ? undefined : search.view,
            page: undefined,
          })
        }
        onClear={() => go({ prac: ownBook ? "all" : undefined, view: undefined, page: undefined })}
        view={view}
        onClearView={() => go({ view: undefined, page: undefined })}
        search={searchText}
        onSearch={setSearchText}
        selectMode={selectMode}
        onToggleSelect={() => {
          setSelectMode((v) => !v);
          setChecked(new Set());
        }}
        canSelect={canSendOffers}
        summary={summaryText}
      />

      {selectMode && canSendOffers ? (
        <div className="mb-2 flex flex-wrap items-center gap-3" data-qc="records-select-bar">
          {checked.size === 0 ? (
            <p className="text-xs text-muted-foreground" data-qc="select-hint">
              Select patients to send an offer.
            </p>
          ) : (
            <>
              <span className="text-xs font-semibold text-foreground">{checked.size} selected</span>
              {!allChecked ? (
                <button
                  type="button"
                  onClick={() => setChecked(new Set(filtered.map((p) => p.id)))}
                  className="cursor-pointer text-xs text-ink-2 underline underline-offset-[3px] hover:text-foreground"
                  data-qc="select-all-matching"
                >
                  Select all {filtered.length} matching
                </button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-8"
                onClick={() => setOfferOpen(true)}
                data-qc="bulk-send-offer"
              >
                <Send className="h-3.5 w-3.5" />
                Send offer · {checked.size}
              </Button>
            </>
          )}
        </div>
      ) : null}

      <div
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]"
        data-qc="records-layout"
      >
        <Card className="overflow-hidden rounded-[18px] p-0">
          <div className="scroll-x-shadows px-2 pt-1.5">
            <RecordsTable
              rows={pageRows}
              selectedId={selectedId}
              onSelect={(id) => {
                go({ sel: id }, { replace: true });
                if (narrow) setSheetOpen(true);
              }}
              selectMode={selectMode}
              checked={checked}
              onCheck={(id, on) =>
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (on) next.add(id);
                  else next.delete(id);
                  return next;
                })
              }
              onCheckAll={(on) => setChecked(on ? new Set(filtered.map((p) => p.id)) : new Set())}
              allChecked={allChecked}
              totalMatching={filtered.length}
              emptyText={
                selectedPracs.length
                  ? "No patients for this practitioner yet."
                  : term
                    ? "No patients match that search."
                    : "No patients yet — add your first record."
              }
              now={now}
            />
          </div>
          <PaginationBar
            page={page}
            pageCount={pageCount}
            total={filtered.length}
            from={filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
            to={Math.min(filtered.length, page * PAGE_SIZE)}
            onPage={(next) => go({ page: next > 1 ? next : undefined })}
            noun="patients"
            qc="patients-pagination"
            className="border-t border-glass-line px-4 py-3"
          />
        </Card>
        {/* Not sticky: on a short laptop the drawer is taller than the viewport and a pinned bottom would sit under the dock. */}
        {narrow === false ? <div>{drawer}</div> : null}
      </div>

      <Sheet open={narrow === true && sheetOpen && !!selected} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-[min(100vw-12px,420px)] overflow-y-auto border-l-0 bg-transparent p-3 shadow-none sm:max-w-none"
          data-qc="records-drawer-sheet"
        >
          <SheetTitle className="sr-only">Patient details</SheetTitle>
          {drawer}
        </SheetContent>
      </Sheet>

      <AssignTaskDialog
        open={!!assignFor}
        onOpenChange={(v) => {
          if (!v) setAssignFor(null);
        }}
        patient={
          assignFor
            ? {
                id: assignFor.id,
                firstName: assignFor.first_name,
                name: `${assignFor.first_name} ${assignFor.last_name}`,
                avatarUrl: assignFor.avatar_url ?? null,
                context: assignFor.summary?.plan
                  ? `${assignFor.summary.plan.name} · ${assignFor.summary.plan.nextStep ?? "next step"}`
                  : assignFor.lastTreatment
                    ? `Last treatment ${assignFor.lastTreatment.name}`
                    : null,
                practitionerId: assignFor.summary?.primaryPractitionerId ?? null,
              }
            : null
        }
        viewerId={identity.userId}
        canAssignOthers={can(identity, "tasks.assign_any")}
      />

      {booking ? (
        <QuickAddAppointment
          patients={patients as unknown[] as never[]}
          practitioners={(practitioners ?? []) as never[]}
          catalogue={(catalogue ?? []) as never[]}
          date={new Date()}
          defaultPatientId={booking.id}
          defaultPractitionerId={booking.summary?.primaryPractitionerId ?? undefined}
          open
          onOpenChange={(v) => {
            if (!v) setBooking(null);
          }}
          title={`Book ${booking.first_name} ${booking.last_name}`}
          centered
        >
          <span className="sr-only">Quick book</span>
        </QuickAddAppointment>
      ) : null}

      {recallFor ? (
        <SendRecallDialog
          key={recallFor.id}
          patientId={recallFor.id}
          patientName={`${recallFor.first_name} ${recallFor.last_name}`}
          patientFirstName={recallFor.first_name}
          email={recallFor.email ?? null}
          phone={recallFor.phone ?? null}
          treatment={
            recallFor.summary?.planStep?.title ??
            recallFor.nextDue?.name ??
            recallFor.lastTreatment?.name ??
            null
          }
          dueDate={recallFor.summary?.planStep?.dueDate ?? recallFor.nextDue?.next_due_at ?? null}
          clinicName={(clinic as { name?: string } | null)?.name ?? "the clinic"}
          practitionerId={recallFor.summary?.primaryPractitionerId ?? null}
          practitionerName={recallFor.summary?.primaryPractitionerName ?? null}
          canAssign={can(identity, "tasks.assign_any")}
          trigger={null}
          open
          onOpenChange={(v) => {
            if (!v) setRecallFor(null);
          }}
        />
      ) : null}

      {canSendOffers ? (
        <SendOfferDialog
          open={offerOpen || !!offerFor}
          onOpenChange={(v) => {
            if (!v) {
              setOfferOpen(false);
              setOfferFor(null);
            }
          }}
          patients={(offerFor ? [offerFor] : filtered.filter((p) => checked.has(p.id))).map(
            (p) => ({
              id: p.id,
              first_name: p.first_name,
              last_name: p.last_name,
            }),
          )}
          source={offerFor ? "one_off" : "bulk"}
          onSent={() => {
            setChecked(new Set());
            setOfferFor(null);
          }}
        />
      ) : null}
    </>
  );
}
