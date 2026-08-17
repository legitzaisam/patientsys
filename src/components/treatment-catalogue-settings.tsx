import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, ClipboardList, Plus, RotateCcw, Search } from "lucide-react";
import {
  listCatalogueItems,
  saveCatalogueItem,
  saveTreatmentColour,
  setCatalogueItemActive,
} from "@/lib/clinic.functions";
import { useTreatmentColours } from "@/lib/use-treatment-colours";
import {
  LANE_OPTIONS,
  defaultLaneFor,
  isHexColour,
  laneTone,
  toneForTreatment,
  treatmentKey,
} from "@/lib/practitioner-colours";
import { ColourWheelButton } from "@/components/colour-wheel-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Item = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
  interval_days: number | null;
  cooling_off_hours: number;
  requires_consent: boolean;
  active: boolean;
};

type Draft = {
  id?: string;
  name: string;
  category: string;
  price: string;
  interval_days: string;
  cooling_off_hours: string;
  requires_consent: boolean;
};

const blank: Draft = {
  name: "",
  category: "",
  price: "",
  interval_days: "",
  cooling_off_hours: "0",
  requires_consent: true,
};

export function TreatmentCatalogueSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const fetchItems = useServerFn(listCatalogueItems);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const overrides = useTreatmentColours();

  const { data } = useQuery({ queryKey: ["catalogue-items"], queryFn: () => fetchItems() });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["catalogue-items"] });
    queryClient.invalidateQueries({ queryKey: ["catalogue"] });
  };

  const save = useMutation({
    mutationFn: useServerFn(saveCatalogueItem),
    onSuccess: () => {
      setDraft(null);
      refresh();
      toast.success("Treatment saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveColour = useMutation({
    mutationFn: useServerFn(saveTreatmentColour),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatment-colours"] });
      toast.success("Treatment colour updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: useServerFn(setCatalogueItemActive),
    onSuccess: () => {
      refresh();
      toast.success("Treatment list updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = useMemo(() => {
    const list = (data ?? []) as Item[];
    const q = search.trim().toLowerCase();
    return q
      ? list.filter(
          (i) => i.name.toLowerCase().includes(q) || (i.category ?? "").toLowerCase().includes(q),
        )
      : list;
  }, [data, search]);

  const commit = () => {
    if (!draft) return;
    save.mutate({
      data: {
        id: draft.id ?? null,
        name: draft.name,
        category: draft.category,
        price: draft.price === "" ? null : Number(draft.price),
        interval_days: draft.interval_days === "" ? null : Number(draft.interval_days),
        cooling_off_hours: draft.cooling_off_hours === "" ? 0 : Number(draft.cooling_off_hours),
        requires_consent: draft.requires_consent,
      },
    });
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-accent-ink" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Treatments offered</h2>
            <p className="text-xs text-muted-foreground">
              {canEdit
                ? "Add treatments, set prices, recall intervals, consent rules and diary colours."
                : "Treatments your clinic offers and their diary colours, set by your manager."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search treatments"
              className="pl-8"
            />
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setDraft({ ...blank })}>
              <Plus className="h-3.5 w-3.5" />
              Add treatment
            </Button>
          )}
        </div>
      </div>

      {draft && (
        <div className="space-y-3 rounded-2xl border border-edge bg-glass-2 p-4">
          <h3 className="text-sm font-semibold text-foreground">
            {draft.id ? "Edit treatment" : "New treatment"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name">
              <Input
                value={draft.name}
                placeholder="Lip filler"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <Input
                value={draft.category}
                placeholder="Injectables"
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
            </Field>
            <Field label="Price (£)">
              <Input
                type="number"
                min="0"
                step="1"
                value={draft.price}
                placeholder="250"
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </Field>
            <Field label="Recall interval (days)">
              <Input
                type="number"
                min="0"
                value={draft.interval_days}
                placeholder="90"
                onChange={(e) => setDraft({ ...draft, interval_days: e.target.value })}
              />
            </Field>
            <Field label="Cooling-off (hours)">
              <Input
                type="number"
                min="0"
                value={draft.cooling_off_hours}
                placeholder="48"
                onChange={(e) => setDraft({ ...draft, cooling_off_hours: e.target.value })}
              />
            </Field>
            <div className="glass-item flex items-center justify-between px-3 py-2">
              <span className="text-xs text-muted-foreground">Consent form required</span>
              <Switch
                checked={draft.requires_consent}
                onCheckedChange={(v) => setDraft({ ...draft, requires_consent: v })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!draft.name.trim() || save.isPending} onClick={commit}>
              Save treatment
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y divide-glass-line rounded-2xl border border-edge">
        {items.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">No treatments match that search.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 p-3">
            <span
              className={`h-6 w-6 shrink-0 rounded-full ${toneForTreatment(item.name, overrides).dot}`}
              style={toneForTreatment(item.name, overrides).style}
              aria-hidden
            />
            <div className="min-w-[10rem] flex-1">
              <p className="text-sm font-medium text-foreground">
                {item.name}
                {!item.active && (
                  <span className="ml-2 rounded-full bg-glass-2 px-2 py-0.5 text-2xs tracking-[0.02em] text-muted-foreground">
                    Archived
                  </span>
                )}
              </p>
              <p className="text-2xs tracking-[0.02em] text-muted-foreground">
                {item.category ?? "Other"}
                {item.price != null && ` · £${Number(item.price).toFixed(0)}`}
                {item.interval_days != null && ` · recall ${item.interval_days}d`}
                {item.requires_consent && " · consent"}
              </p>
            </div>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-1.5">
                <ColourPicker
                  name={item.name}
                  overrides={overrides}
                  disabled={saveColour.isPending}
                  onPick={(lane, hex) =>
                    saveColour.mutate({ data: { treatment_name: treatmentKey(item.name), lane, hex } })
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      id: item.id,
                      name: item.name,
                      category: item.category ?? "",
                      price: item.price == null ? "" : String(item.price),
                      interval_days: item.interval_days == null ? "" : String(item.interval_days),
                      cooling_off_hours: String(item.cooling_off_hours ?? 0),
                      requires_consent: item.requires_consent,
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={toggleActive.isPending}
                  onClick={() => toggleActive.mutate({ data: { id: item.id, active: !item.active } })}
                >
                  {item.active ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  {item.active ? "Archive" : "Restore"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Compact lane swatches + colour wheel + reset for one treatment. */
function ColourPicker({
  name,
  overrides,
  disabled,
  onPick,
}: {
  name: string;
  overrides: Record<string, number | string>;
  disabled?: boolean;
  onPick: (lane: number | null, hex: string | null) => void;
}) {
  const override = overrides[treatmentKey(name)];
  const custom = isHexColour(override) ? override : null;
  const lane = typeof override === "number" ? override : defaultLaneFor(name);
  return (
    <div className="flex items-center gap-1 rounded-full border border-edge bg-glass-2 px-2 py-1">
      {LANE_OPTIONS.map((opt) => {
        const tone = laneTone(opt.lane);
        const active = !custom && lane === opt.lane;
        return (
          <button
            key={opt.lane}
            type="button"
            disabled={disabled}
            title={opt.label}
            aria-label={`${opt.label} for ${name}`}
            aria-pressed={active}
            onClick={() => onPick(opt.lane, null)}
            className={`h-4 w-4 rounded-full ${tone.dot} transition-all hover:scale-125 hover:opacity-100 ${
              active ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : "opacity-70"
            }`}
          />
        );
      })}
      <ColourWheelButton
        value={custom ?? "#b9a6e8"}
        active={!!custom}
        label={`Custom colour for ${name}`}
        disabled={disabled}
        onPick={(hex) => onPick(null, hex)}
      />
      <button
        type="button"
        disabled={disabled || override === undefined}
        title="Reset colour"
        aria-label={`Reset colour for ${name}`}
        onClick={() => onPick(null, null)}
        className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
