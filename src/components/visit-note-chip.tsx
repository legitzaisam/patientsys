import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StickyNote } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAppointmentNote, saveAppointmentNote } from "@/lib/clinic.functions";
import {
  appointmentNoteQueryKey,
  type AppointmentNoteData,
} from "@/lib/appointment-note-cache";
import {
  NotesTextarea,
  NotesToolbar,
  SaveState,
  insertBullet,
  useNotesPrefs,
} from "@/components/notes/ios-notes-editor";

export function VisitNoteEditor({
  appointmentId,
  className,
  minHeightClass = "min-h-[160px]",
  footerEnd,
}: {
  appointmentId: string;
  className?: string;
  minHeightClass?: string;
  footerEnd?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const fetchNote = useServerFn(getAppointmentNote);
  const saveFn = useServerFn(saveAppointmentNote);
  const key = appointmentNoteQueryKey(appointmentId);

  const writeCache = (body: string, extras?: { updatedAt?: string | null; updatedBy?: string | null }) => {
    queryClient.setQueryData(key, (prev: AppointmentNoteData | undefined) => ({
      body,
      updatedAt: extras?.updatedAt ?? prev?.updatedAt ?? null,
      updatedBy: extras?.updatedBy ?? prev?.updatedBy ?? null,
    }));
  };

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => fetchNote({ data: { appointment_id: appointmentId } }),
  });

  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const hydrated = useRef(false);
  const valueRef = useRef(value);
  const dirtyRef = useRef(dirty);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const prefs = useNotesPrefs("notes-prefs:visit-notes");

  useEffect(() => {
    valueRef.current = value;
    dirtyRef.current = dirty;
  }, [value, dirty]);

  useEffect(() => {
    hydrated.current = false;
    setValue("");
    setDirty(false);
  }, [appointmentId]);

  useEffect(() => {
    if (data && !hydrated.current) {
      setValue(data.body ?? "");
      hydrated.current = true;
    }
  }, [data]);

  const save = useMutation({
    mutationFn: saveFn,
    onSuccess: (res) => {
      setDirty(false);
      dirtyRef.current = false;
      queryClient.setQueryData(key, res);
      // Refresh diary lists so embeds keep the note icon accurate after navigation.
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-week"] });
      void queryClient.invalidateQueries({ queryKey: ["patient"] });
    },
  });

  const persist = (body: string) => {
    writeCache(body);
    save.mutate({ data: { appointment_id: appointmentId, body } });
  };

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => persist(value), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, dirty]);

  // Flush pending edits when leaving / unmounting.
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      const body = valueRef.current;
      dirtyRef.current = false;
      writeCache(body);
      void saveFn({ data: { appointment_id: appointmentId, body } }).then((res) => {
        queryClient.setQueryData(appointmentNoteQueryKey(appointmentId), res);
        void queryClient.invalidateQueries({ queryKey: ["appointments"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-week"] });
        void queryClient.invalidateQueries({ queryKey: ["patient"] });
      });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, saveFn, queryClient]);

  const update = (v: string) => {
    setValue(v);
    setDirty(true);
  };

  return (
    <div className={`w-full min-w-0 ${className ?? ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Visit note</p>
          <p className="text-2xs text-muted-foreground">
            {data?.updatedBy ? `Last edited by ${data.updatedBy}` : "Shared with the clinical team"}
          </p>
        </div>
        <NotesToolbar prefs={prefs} onBullet={() => insertBullet(areaRef.current, value, update)} />
      </div>
      <NotesTextarea
        textareaRef={areaRef}
        value={value}
        onChange={update}
        prefs={prefs}
        placeholder="Notes for this visit…"
        className={minHeightClass}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2 pl-1">
        <SaveState saving={save.isPending} dirty={dirty} />
        {footerEnd}
      </div>
    </div>
  );
}

export function VisitNoteChip({
  appointmentId,
  chipClass,
  compact: _compact,
  variant = "chip",
}: {
  appointmentId: string;
  chipClass?: string;
  compact?: boolean;
  /** Ghost: minimal icon on schedule day cards. Chip: icon on diary / week cards. */
  variant?: "chip" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const fetchNote = useServerFn(getAppointmentNote);
  const key = appointmentNoteQueryKey(appointmentId);
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => fetchNote({ data: { appointment_id: appointmentId } }),
  });

  const body = (data?.body ?? "").trim();
  const has = body.length > 0;
  const preview = has
    ? body.length > 160
      ? `${body.slice(0, 160).trimEnd()}…`
      : body
    : null;

  // Only surface the icon when this appointment actually has a visit note.
  if (!has) return null;

  const setEditorOpen = (next: boolean) => {
    setOpen(next);
    if (next) setHoverOpen(false);
  };

  const trigger =
    variant === "ghost" ? (
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Open visit note"
        className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <StickyNote className="h-2 w-2" />
      </button>
    ) : (
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Open visit note"
        className={`inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground ${chipClass ?? ""}`}
      >
        <StickyNote className="h-3 w-3 shrink-0" />
      </button>
    );

  return (
    <HoverCard
      open={hoverOpen && !open}
      onOpenChange={(v) => {
        if (!open) setHoverOpen(v);
      }}
      openDelay={200}
      closeDelay={100}
    >
      <Popover open={open} onOpenChange={setEditorOpen}>
        <HoverCardTrigger asChild>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        </HoverCardTrigger>
        <PopoverContent
          align="end"
          className="w-80 rounded-2xl p-3"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <VisitNoteEditor appointmentId={appointmentId} />
        </PopoverContent>
      </Popover>
      <HoverCardContent
        align="end"
        side="top"
        className="w-56 rounded-xl p-3"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {has ? (
          <>
            <p className="text-2xs font-semibold tracking-[0.02em] text-muted-foreground">Visit note</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">{preview}</p>
            {data?.updatedBy ? (
              <p className="mt-2 text-2xs text-muted-foreground">{data.updatedBy}</p>
            ) : null}
            <p className="mt-2 text-2xs text-muted-foreground">Click to edit</p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold text-foreground">Add a visit note</p>
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              Quick notes for this appointment — shared with the clinical team.
            </p>
            <p className="mt-2 text-2xs text-muted-foreground">Click to write</p>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
