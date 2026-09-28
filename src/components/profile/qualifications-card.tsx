import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  getCatalogue,
  saveMyInstantProfile,
  setBookableTreatments,
  updateStaffMember,
} from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  invalidateProfileQueries,
  joinQualifications,
  splitQualifications,
} from "./profile-helpers";
import type { ProfileMode, ProfileSubject } from "./profile-types";

export function QualificationsCard({
  mode,
  subject,
  canEditBookable,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  canEditBookable: boolean;
}) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<string[]>(() => splitQualifications(subject.qualifications));
  const [draft, setDraft] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [editingBookable, setEditingBookable] = useState(false);
  const [picked, setPicked] = useState<string[]>(() => subject.bookable.map((b) => b.catalogueId));

  useEffect(() => {
    setItems(splitQualifications(subject.qualifications));
  }, [subject.qualifications]);
  useEffect(() => {
    if (!editingBookable) setPicked(subject.bookable.map((b) => b.catalogueId));
  }, [subject.bookable, editingBookable]);

  const saveInstant = useServerFn(saveMyInstantProfile);
  const saveTheirs = useServerFn(updateStaffMember);
  const saveQuals = useMutation({
    mutationFn: async (next: string[]) => {
      const qualifications = joinQualifications(next);
      if (mode === "manage") {
        return saveTheirs({
          data: {
            userId: subject.userId,
            role: (subject.role || "practitioner") as
              "owner" | "manager" | "practitioner" | "front_desk",
            fullName: subject.fullName,
            jobTitle: subject.jobTitle,
            registrationBody: subject.registrationBody,
            registrationNumber: subject.registrationNumber,
            registrationExpiry: subject.registrationExpiry,
            insuranceProvider: subject.insuranceProvider,
            insuranceExpiry: subject.insuranceExpiry,
            qualifications,
            workingArrangement: subject.workingArrangement,
          },
        });
      }
      return saveInstant({
        data: {
          qualifications,
          insuranceProvider: subject.insuranceProvider,
          insuranceExpiry: subject.insuranceExpiry,
        },
      });
    },
    onSuccess: () => {
      setSavedAt(Date.now());
      invalidateProfileQueries(queryClient, subject.userId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    const next = [...items, v];
    setItems(next);
    setDraft("");
    saveQuals.mutate(next);
  };
  const remove = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    saveQuals.mutate(next);
  };

  const fetchCatalogue = useServerFn(getCatalogue);
  const { data: catalogueRows } = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => fetchCatalogue(),
    enabled: editingBookable,
    staleTime: 5 * 60_000,
  });
  const catalogueItems = (
    (catalogueRows ?? []) as { id: string; name: string; category?: string | null }[]
  )
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const saveBookable = useMutation({
    mutationFn: useServerFn(setBookableTreatments),
    onSuccess: () => {
      setEditingBookable(false);
      toast.success("Bookable treatments updated");
      invalidateProfileQueries(queryClient, subject.userId);
      queryClient.invalidateQueries({ queryKey: ["bookable", subject.userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editable = !subject.revoked;

  return (
    <Card className="flex flex-col gap-4 p-6" data-qc="qualifications">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title">Qualifications</h2>
        <span className="text-xs text-muted-foreground" data-qc="qualifications-saved">
          {saveQuals.isPending ? "Saving…" : savedAt ? "Saved" : "Saves instantly"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2" data-qc="qualification-chips">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No qualifications listed yet.</p>
        ) : null}
        {items.map((q, i) => (
          <span
            key={`${q}-${i}`}
            className="inline-flex h-9 items-center gap-0.5 rounded-full bg-accent-soft pl-3.5 pr-1 text-sm font-medium text-foreground shadow-inset-hi"
            data-qc="qualification-chip"
          >
            {q}
            {editable ? (
              <button
                type="button"
                aria-label={`Remove ${q}`}
                onClick={() => remove(i)}
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="w-2.5" />
            )}
          </span>
        ))}
      </div>
      {editable ? (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add a qualification, e.g. Level 4 Chemical Peels"
            aria-label="Add a qualification"
            className="flex-1"
            data-qc="qualification-input"
          />
          <Button type="button" onClick={add} disabled={!draft.trim()} data-qc="qualification-add">
            Add
          </Button>
        </div>
      ) : null}

      <div className="h-px bg-edge-2" />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-foreground">
          {mode === "self"
            ? "Treatments front desk can book you for"
            : "Treatments front desk can book them for"}
        </h3>
        {canEditBookable && editable ? (
          editingBookable ? null : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingBookable(true)}
              data-qc="bookable-edit"
            >
              Edit
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">Set by your manager</span>
        )}
      </div>
      {!editingBookable ? (
        <div className="flex flex-wrap gap-2" data-qc="bookable-chips">
          {subject.bookable.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing set yet.</p>
          ) : (
            subject.bookable.map((b) => (
              <span
                key={b.catalogueId}
                className="inline-flex h-9 items-center rounded-full bg-glass-2 px-3.5 text-sm text-foreground shadow-inset-hi"
                data-qc="bookable-chip"
              >
                {b.name}
              </span>
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-qc="bookable-editor">
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-edge bg-card/60 p-2">
            {catalogueItems.length === 0 ? (
              <p className="px-1 py-1 text-xs text-muted-foreground">Loading treatments…</p>
            ) : (
              catalogueItems.map((item) => {
                const checked = picked.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex min-h-7 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-xs hover:bg-glass-2"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setPicked((prev) =>
                          prev.includes(item.id)
                            ? prev.filter((x) => x !== item.id)
                            : [...prev, item.id],
                        )
                      }
                      aria-label={item.name}
                    />
                    <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
                    {item.category ? (
                      <span className="shrink-0 text-2xs text-muted-foreground">
                        {item.category}
                      </span>
                    ) : null}
                  </label>
                );
              })
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingBookable(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saveBookable.isPending}
              onClick={() =>
                saveBookable.mutate({ data: { userId: subject.userId, catalogueIds: picked } })
              }
              data-qc="bookable-save"
            >
              {saveBookable.isPending
                ? "Saving…"
                : `Save ${picked.length} treatment${picked.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
