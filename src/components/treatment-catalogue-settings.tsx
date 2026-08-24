import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { SaveCatalogueItem } from "@/lib/validation/schemas";
import { numericText } from "@/lib/validation/primitives";
import { ColourWheelButton } from "@/components/colour-wheel-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type Item = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
  interval_days: number | null;
  duration_minutes: number;
  cooling_off_hours: number;
  requires_consent: boolean;
  active: boolean;
};

type Draft = {
  name: string;
  category: string;
  price: string;
  interval_days: string;
  duration_minutes: string;
  cooling_off_hours: string;
  requires_consent: boolean;
};

const blank: Draft = {
  name: "",
  category: "",
  price: "",
  interval_days: "",
  duration_minutes: "60",
  cooling_off_hours: "0",
  requires_consent: true,
};

const shape = SaveCatalogueItem.shape;
/** Blank fallbacks mirror `commit` exactly; the bounds come from the server schema. */
const DraftSchema = z.object({
  name: shape.name,
  category: z.string().trim().max(120),
  price: numericText(shape.price, null),
  interval_days: numericText(shape.interval_days, null),
  duration_minutes: numericText(shape.duration_minutes, 60),
  cooling_off_hours: numericText(shape.cooling_off_hours, 0),
  requires_consent: z.boolean(),
});

export function TreatmentCatalogueSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const fetchItems = useServerFn(listCatalogueItems);
  const [search, setSearch] = useState("");
  /** null closes the panel; `id` is null for a new treatment. */
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const overrides = useTreatmentColours();

  const draftForm = useForm<Draft>({
    resolver: zodResolver(DraftSchema),
    defaultValues: blank,
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const openDraft = (id: string | null, values: Draft) => {
    draftForm.reset(values);
    setEditing({ id });
  };

  const { data } = useQuery({ queryKey: ["catalogue-items"], queryFn: () => fetchItems() });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["catalogue-items"] });
    queryClient.invalidateQueries({ queryKey: ["catalogue"] });
  };

  const save = useMutation({
    mutationFn: useServerFn(saveCatalogueItem),
    onSuccess: () => {
      setEditing(null);
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

  const commit = (values: Draft) => {
    save.mutate({
      data: {
        id: editing?.id ?? null,
        name: values.name,
        category: values.category,
        price: values.price === "" ? null : Number(values.price),
        interval_days: values.interval_days === "" ? null : Number(values.interval_days),
        duration_minutes: values.duration_minutes === "" ? 60 : Number(values.duration_minutes),
        cooling_off_hours: values.cooling_off_hours === "" ? 0 : Number(values.cooling_off_hours),
        requires_consent: values.requires_consent,
      },
    });
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-ink-3" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Treatments offered</h2>
            <p className="text-xs text-muted-foreground">
              {canEdit
                ? "Add treatments, set prices, appointment length, recall intervals, consent rules and diary colours."
                : "Treatments your clinic offers and their diary colours, set by your manager."}
            </p>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
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
            <Button size="sm" onClick={() => openDraft(null, { ...blank })}>
              <Plus className="h-3.5 w-3.5" />
              Add treatment
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <Form {...draftForm}>
          <form
            noValidate
            onSubmit={draftForm.handleSubmit(commit)}
            className="space-y-3 rounded-2xl border border-edge bg-glass-2 p-4"
          >
            <h3 className="text-sm font-semibold text-foreground">
              {editing.id ? "Edit treatment" : "New treatment"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DraftField
                control={draftForm.control}
                name="name"
                label="Name"
                placeholder="Lip filler"
              />
              <DraftField
                control={draftForm.control}
                name="category"
                label="Category"
                placeholder="Injectables"
              />
              <DraftField
                control={draftForm.control}
                name="price"
                label="Price (£)"
                placeholder="250"
                type="number"
                min="0"
                step="1"
              />
              <DraftField
                control={draftForm.control}
                name="interval_days"
                label="Recall interval (days)"
                placeholder="90"
                type="number"
                min="0"
              />
              <DraftField
                control={draftForm.control}
                name="duration_minutes"
                label="Appointment length (min)"
                placeholder="60"
                type="number"
                min="5"
                max="480"
                step="5"
              />
              <DraftField
                control={draftForm.control}
                name="cooling_off_hours"
                label="Cooling-off (hours)"
                placeholder="48"
                type="number"
                min="0"
              />
              <FormField
                control={draftForm.control}
                name="requires_consent"
                render={({ field }) => (
                  <div className="glass-item flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted-foreground">Consent form required</span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                Save treatment
              </Button>
            </div>
          </form>
        </Form>
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
                {` · ${item.duration_minutes ?? 60} min`}
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
                    openDraft(item.id, {
                      name: item.name,
                      category: item.category ?? "",
                      price: item.price == null ? "" : String(item.price),
                      interval_days: item.interval_days == null ? "" : String(item.interval_days),
                      duration_minutes: String(item.duration_minutes ?? 60),
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

function DraftField({
  control,
  name,
  label,
  ...input
}: {
  control: Control<Draft>;
  name: Exclude<keyof Draft, "requires_consent">;
  label: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs text-muted-foreground">{label}</FormLabel>
          <FormControl>
            <Input {...input} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
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
