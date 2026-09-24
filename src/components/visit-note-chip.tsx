import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StickyNote, X } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAppointmentNote, saveAppointmentNote } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { plainVisitNote } from "@/lib/sanitize-note-html";
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

/**
 * Booking notes are what the patient mentioned on the phone or at booking.
 * They are the only note shown on an appointment card. Notes written during
 * treatment stay on the patient record.
 */
export function isPreAppointmentNote(a: { stage?: string | null; status?: string | null }) {
  // Arrived and waiting patients are already marked attended; the stage is
  // what says whether treatment has begun.
  if (a.status === "no_show" || a.status === "cancelled") return false;
  const stage = a.stage ?? (a.status === "attended" ? "complete" : "booked");
  return stage === "booked" || stage === "arrived" || stage === "waiting";
}

export function VisitNoteEditor({
  appointmentId,
  className,
  minHeightClass = "min-h-[160px]",
  footerEnd,
  onClose,
  preRead: _preRead = false,
}: {
  appointmentId: string;
  className?: string;
  minHeightClass?: string;
  footerEnd?: ReactNode;
  onClose?: () => void;
  /** The appointment is still to come: frame the note as the pre-read. */
  preRead?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: identity } = useIdentity();
  const editorName =
    typeof identity?.profile?.full_name === "string" ? identity.profile.full_name : null;
  const editorNameRef = useRef(editorName);
  editorNameRef.current = editorName;
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
  const originalRef = useRef("");
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
    originalRef.current = "";
  }, [appointmentId]);

  useEffect(() => {
    if (data && !hydrated.current) {
      const plain = plainVisitNote(data.body);
      setValue(plain);
      originalRef.current = plain;
      hydrated.current = true;
    }
  }, [data]);

  const noteChanged = (body: string) => plainVisitNote(body) !== originalRef.current;

  const save = useMutation({
    mutationFn: saveFn,
    onSuccess: (res) => {
      const plain = plainVisitNote(res.body);
      setDirty(false);
      dirtyRef.current = false;
      originalRef.current = plain;
      queryClient.setQueryData(key, { ...res, body: plain });
      // Refresh diary lists so embeds keep the note icon accurate after navigation.
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-week"] });
      void queryClient.invalidateQueries({ queryKey: ["patient"] });
    },
  });

  const persist = (body: string) => {
    const plain = plainVisitNote(body);
    if (!noteChanged(plain)) return;
    writeCache(plain, editorNameRef.current ? { updatedBy: editorNameRef.current } : undefined);
    save.mutate({ data: { appointment_id: appointmentId, body: plain } });
  };

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => persist(value), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, dirty]);

  const discardPending = () => {
    const original = originalRef.current;
    setValue(original);
    setDirty(false);
    dirtyRef.current = false;
    valueRef.current = original;
    writeCache(original);
  };

  // Flush pending edits when leaving / unmounting — only if the text changed.
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      const body = plainVisitNote(valueRef.current);
      dirtyRef.current = false;
      if (!noteChanged(body)) return;
      writeCache(body, editorNameRef.current ? { updatedBy: editorNameRef.current } : undefined);
      void saveFn({ data: { appointment_id: appointmentId, body } }).then((res) => {
        queryClient.setQueryData(appointmentNoteQueryKey(appointmentId), {
          ...res,
          body: plainVisitNote(res.body),
        });
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
    setDirty(plainVisitNote(v) !== originalRef.current);
  };

  const closeEditor = () => {
    discardPending();
    onClose?.();
  };

  return (
    <div className={`w-full min-w-0 ${className ?? ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Booking Notes</p>
          <p className="text-2xs text-muted-foreground">
            {data?.updatedBy ? `Last edited by ${data.updatedBy}` : "What the patient mentioned when booking."}
          </p>
        </div>
        <NotesToolbar prefs={prefs} onBullet={() => insertBullet(areaRef.current, value, update)} />
      </div>
      <NotesTextarea
        textareaRef={areaRef}
        value={value}
        onChange={update}
        prefs={prefs}
        placeholder="Anything the patient mentioned when booking…"
        className={minHeightClass}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2 pl-1">
        <SaveState saving={save.isPending} dirty={dirty} />
        <div className="flex items-center gap-1.5">
          {footerEnd}
          {onClose ? (
            <button
              type="button"
              aria-label="Close visit note"
              onClick={(e) => {
                e.stopPropagation();
                closeEditor();
              }}
              className="grid h-8 w-8 place-items-center rounded-full border border-edge bg-glass-2 text-ink-2 shadow-inset-hi transition-colors hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function VisitNoteChip({
  appointmentId,
  chipClass,
  compact: _compact,
  variant = "chip",
  preRead: _preRead = false,
}: {
  appointmentId: string;
  chipClass?: string;
  compact?: boolean;
  /** Ghost: minimal icon on schedule day cards. Chip: icon on diary / week cards. */
  variant?: "chip" | "ghost";
  /** The appointment is still to come: the hover reads as the pre-read. */
  preRead?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const fetchNote = useServerFn(getAppointmentNote);
  const key = appointmentNoteQueryKey(appointmentId);
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => fetchNote({ data: { appointment_id: appointmentId } }),
  });

  const body = plainVisitNote(data?.body);
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
        aria-label="Open booking notes"
        className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <StickyNote className="h-2 w-2" />
      </button>
    ) : (
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Open booking notes"
        className={`inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-sky-bg text-sky-ink shadow-inset-hi transition-[filter,box-shadow] hover:brightness-[0.96] hover:shadow-lift active:brightness-[0.9] ${chipClass ?? ""}`}
      >
        <StickyNote className="h-2.5 w-2.5 shrink-0" />
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
          <VisitNoteEditor appointmentId={appointmentId} onClose={() => setEditorOpen(false)} />
        </PopoverContent>
      </Popover>
      <HoverCardContent
        align="end"
        side="top"
        className="w-56 cursor-pointer rounded-xl p-3"
        onClick={(e) => {
          e.stopPropagation();
          setEditorOpen(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditorOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {has ? (
          <>
            <p className="text-2xs font-semibold tracking-[0.02em] text-muted-foreground">Booking Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">{preview}</p>
            {data?.updatedBy ? (
              <p className="mt-2 text-2xs text-muted-foreground">{data.updatedBy}</p>
            ) : null}
            <p className="mt-2 text-2xs text-muted-foreground">Click to edit</p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold text-foreground">Booking Notes</p>
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              What the patient mentioned when booking.
            </p>
            <p className="mt-2 text-2xs text-muted-foreground">Click to write</p>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
