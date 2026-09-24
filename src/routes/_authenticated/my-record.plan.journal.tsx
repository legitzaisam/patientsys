import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Link2, Play, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { createJournalEntry, deleteJournalEntry, getPortalJournal } from "@/lib/clinic.functions";
import { PlanTabs } from "@/components/portal/plan-tabs";
import { PortalCard, PortalHead } from "@/components/portal/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-record/plan/journal")({
  component: PlanJournal,
});

const FILTERS = [
  { label: "All", kinds: [] as string[] },
  { label: "Skincare", kinds: ["skincare"] },
  { label: "Photos", kinds: ["photos"] },
  { label: "Vitamins", kinds: ["vitamins"] },
  { label: "Other appointments", kinds: ["appointment"] },
  { label: "Skin changes", kinds: ["skin_change"] },
  { label: "Voice notes", kinds: ["voice_note"] },
];

const TAG_TONE: Record<string, string> = {
  skincare: "bg-sky-bg text-sky-ink",
  photos: "bg-sky-bg text-sky-ink",
  vitamins: "bg-rose-bg text-rose-ink",
  appointment: "bg-glass-2 text-muted-foreground",
  skin_change: "bg-accent-soft text-accent-ink",
  voice_note: "bg-warning-bg text-warning-ink",
};

const TAG_LABEL: Record<string, string> = {
  skincare: "Skincare",
  photos: "Photos",
  vitamins: "Vitamins",
  appointment: "Appointment",
  skin_change: "Skin change",
  voice_note: "Voice note",
};

function PlanJournal() {
  const queryClient = useQueryClient();
  const fetchJournal = useServerFn(getPortalJournal);
  const { data, isLoading } = useQuery({ queryKey: ["portal-journal"], queryFn: () => fetchJournal() });

  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal-journal"] });
  const remove = useMutation({
    mutationFn: useServerFn(deleteJournalEntry),
    onSuccess: () => {
      toast.success("Entry deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entries = useMemo(() => {
    const all = data?.entries ?? [];
    const kinds = FILTERS.find((f) => f.label === filter)?.kinds ?? [];
    const byKind = kinds.length === 0 ? all : all.filter((e: any) => kinds.includes(e.kind));
    const q = query.trim().toLowerCase();
    if (!q) return byKind;
    return byKind.filter(
      (e: any) => e.title.toLowerCase().includes(q) || String(e.body ?? "").toLowerCase().includes(q),
    );
  }, [data, filter, query]);

  const monthLabel = entries[0]
    ? new Date(entries[0].date).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const markedDays = new Set((data?.entries ?? []).map((e: any) => new Date(e.date).getDate()));

  return (
    <div data-qc="portal-journal">
      <div className="page-header">
        <div>
          <h1 className="page-title">Your Journal</h1>
          <p className="page-subtitle">Track your progress, stay consistent, and see how far you've come.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
            <input
              data-qc="journal-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search journal..."
              aria-label="Search journal"
              className="h-[34px] w-[210px] rounded-[11px] border border-edge-2 bg-glass-2 pl-8 pr-3 text-xs shadow-inset-hi"
            />
          </label>
          <button
            type="button"
            data-qc="journal-new"
            onClick={() => setComposing(true)}
            className="inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-semibold text-accent-foreground shadow-bloom hover:brightness-105"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> New entry
          </button>
        </div>
      </div>

      <PlanTabs />

      <div className="grid items-stretch gap-3.5 xl:grid-cols-[2.05fr_1fr]">
        <div>
          {/* One Tags button in place of the chip row: the menu lists every tag
              and shows which one is active; "All" clears it. */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="section-title ml-0.5">{monthLabel}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-qc="journal-tags"
                  aria-label={`Filter by tag: ${filter}`}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs shadow-[inset_0_0_0_1px_var(--edge-2)] transition-colors",
                    filter !== "All"
                      ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--accent-line)]"
                      : "bg-glass-2 text-ink-2 hover:bg-[rgba(47,63,102,0.08)]",
                  )}
                >
                  <Tag className="h-3 w-3" aria-hidden />
                  {filter === "All" ? "Tags" : filter}
                  <ChevronDown className="h-3 w-3 text-ink-3" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {FILTERS.map((f) => (
                  <DropdownMenuItem
                    key={f.label}
                    data-qc="journal-filter"
                    data-active={filter === f.label ? "1" : "0"}
                    onClick={() => setFilter(f.label)}
                    className="justify-between text-xs"
                  >
                    {f.label}
                    {filter === f.label ? <Check className="h-3.5 w-3.5 text-accent-ink" aria-hidden /> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isLoading && <p className="p-4 text-xs text-muted-foreground">Loading your journal…</p>}
          {!isLoading && entries.length === 0 && (
            <PortalCard>
              <p className="py-6 text-center text-xs text-muted-foreground">
                {query || filter !== "All" ? "Nothing matches that filter." : "No entries yet — add your first one."}
              </p>
            </PortalCard>
          )}

          <div className="grid gap-2.5">
            {entries.map((e: any) => (
              <PortalCard key={e.id} className="p-4">
                <div className="flex items-start gap-3.5">
                  <p className="w-[74px] shrink-0 pt-px text-xs tabular-nums text-muted-foreground">
                    {new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 truncate text-[13.5px] font-semibold">{e.title}</p>
                      <span
                        data-qc="journal-tag"
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-semibold",
                          TAG_TONE[e.kind] ?? "bg-glass-2 text-muted-foreground",
                        )}
                      >
                        <Tag className="h-2.5 w-2.5" aria-hidden />
                        {TAG_LABEL[e.kind] ?? e.kind}
                      </span>
                    </div>
                    {e.body && <p className="mt-1 max-w-[420px] text-xs leading-relaxed text-muted-foreground">{e.body}</p>}
                    {e.attachments.some((a: any) => a.kind === "voice") && (
                      <div className="mt-2 flex max-w-[290px] items-center gap-2.5 rounded-[16px] border border-edge-2 bg-glass-2 px-3 py-2 shadow-inset-hi">
                        <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[10px] bg-accent text-accent-ink">
                          <Play className="h-3 w-3" aria-hidden />
                        </span>
                        <span className="flex h-4 flex-1 items-center gap-[1.5px]">
                          {Array.from({ length: 34 }, (_, i) => (
                            <span
                              key={i}
                              className="flex-1 rounded-[1px] bg-bar"
                              style={{ height: `${25 + Math.abs(Math.sin(i * 1.7)) * 70}%` }}
                            />
                          ))}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          0:{String(e.attachments.find((a: any) => a.kind === "voice")?.duration_seconds ?? 0).padStart(2, "0")}
                        </span>
                      </div>
                    )}
                  </div>
                  {e.attachments.filter((a: any) => a.kind === "photo").length > 0 && (
                    <div className="flex shrink-0 gap-1.5">
                      {e.attachments
                        .filter((a: any) => a.kind === "photo")
                        .slice(0, 2)
                        .map((a: any) => (
                          <img
                            key={a.id}
                            src={a.url}
                            alt=""
                            className="h-[62px] w-[68px] rounded-[11px] object-cover"
                          />
                        ))}
                    </div>
                  )}
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      data-qc="journal-delete"
                      aria-label={`Delete ${e.title}`}
                      onClick={() => remove.mutate({ data: { id: e.id } })}
                      className="grid h-6 w-6 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-destructive-bg hover:text-destructive-ink"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                </div>
              </PortalCard>
            ))}
          </div>
        </div>

        <div className="grid gap-3.5">
          <PortalCard>
            <PortalHead title={monthLabel} />
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d} className="pb-1 text-[9.5px] text-muted-foreground">
                  {d}
                </span>
              ))}
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                <span
                  key={d}
                  className={cn(
                    "grid h-6 place-items-center rounded-full text-[11px] tabular-nums",
                    markedDays.has(d)
                      ? "bg-accent-soft font-semibold text-accent-ink shadow-[inset_0_0_0_1px_var(--accent-line)]"
                      : "text-ink-3",
                  )}
                >
                  {d}
                </span>
              ))}
            </div>
          </PortalCard>

          <PortalCard>
            <PortalHead icon={Link2} title="Share your journal" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Select what you'd like to share with your clinic or for a second opinion.
            </p>
            <button
              type="button"
              data-qc="journal-share"
              onClick={() => toast.success("Your journal is already shared with your clinic")}
              className="mt-3 inline-flex h-[34px] w-full cursor-pointer items-center justify-center rounded-full bg-glass-2 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]"
            >
              Create shareable document
            </button>
          </PortalCard>
        </div>
      </div>

      {composing && <NewEntryModal onClose={() => setComposing(false)} />}
    </div>
  );
}

function NewEntryModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("skincare");

  const create = useMutation({
    mutationFn: useServerFn(createJournalEntry),
    onSuccess: () => {
      toast.success("Entry added");
      void queryClient.invalidateQueries({ queryKey: ["portal-journal"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(47,63,102,0.28)] p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-label="New journal entry"
        data-qc="journal-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ data: { title, body, kind } });
        }}
        className="w-[min(430px,100%)] rounded-[22px] border border-edge bg-white/95 p-[18px] shadow-popover"
      >
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">New journal entry</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Anything you note here is shared with your clinic so they can see how you are getting on.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-6 w-6 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-glass-2"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>

        <label className="mt-3.5 block">
          <span className="text-xs font-semibold">Title</span>
          <input
            data-qc="journal-title"
            value={title}
            required
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Started a new moisturiser"
            className="mt-1.5 h-[34px] w-full rounded-[11px] border border-edge-2 bg-glass-2 px-2.5 text-xs shadow-inset-hi"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold">Category</span>
          <select
            data-qc="journal-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="mt-1.5 h-[34px] w-full rounded-[11px] border border-edge-2 bg-glass-2 px-2.5 text-xs shadow-inset-hi"
          >
            {Object.entries(TAG_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold">Notes</span>
          <textarea
            data-qc="journal-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="How is your skin today?"
            className="mt-1.5 min-h-[74px] w-full rounded-[11px] border border-edge-2 bg-glass-2 px-2.5 py-2 text-xs shadow-inset-hi"
          />
        </label>

        <div className="mt-3.5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[34px] flex-1 cursor-pointer items-center justify-center rounded-full bg-glass-2 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-qc="journal-save"
            disabled={!title.trim() || create.isPending}
            className="inline-flex h-[34px] flex-1 cursor-pointer items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground shadow-bloom disabled:opacity-45"
          >
            Save entry
          </button>
        </div>
      </form>
    </div>
  );
}
