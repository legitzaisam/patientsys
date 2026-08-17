import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StickyNote } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAppointmentNote, saveAppointmentNote } from "@/lib/clinic.functions";
import {
  NotesTextarea,
  NotesToolbar,
  SaveState,
  insertBullet,
  useNotesPrefs,
} from "@/components/notes/ios-notes-editor";

export function VisitNoteChip({
  appointmentId,
  chipClass,
  compact,
}: {
  appointmentId: string;
  chipClass?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const fetchNote = useServerFn(getAppointmentNote);
  const key = ["appointment-note", appointmentId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => fetchNote({ data: { appointment_id: appointmentId } }),
  });

  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const hydrated = useRef(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const prefs = useNotesPrefs("notes-prefs:visit-notes");

  useEffect(() => {
    if (data && !hydrated.current) {
      setValue(data.body ?? "");
      hydrated.current = true;
    }
  }, [data]);

  const save = useMutation({
    mutationFn: useServerFn(saveAppointmentNote),
    onSuccess: (res) => {
      setDirty(false);
      queryClient.setQueryData(key, res);
    },
  });

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => save.mutate({ data: { appointment_id: appointmentId, body: value } }), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, dirty]);

  const update = (v: string) => {
    setValue(v);
    setDirty(true);
  };

  const has = (data?.body ?? "").trim().length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={has ? "Visit note saved" : "Add a visit note"}
          className={`${chipClass ?? ""} ${
            has ? "bg-accent-soft text-accent-ink" : "bg-glass-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          <StickyNote className="h-3 w-3" />
          {compact ? null : has ? "Note" : "Add note"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-2xl p-3"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Visit note</p>
            <p className="text-2xs text-muted-foreground">
              {data?.updatedBy ? `Last edited by ${data.updatedBy}` : "Shared with the clinical team"}
            </p>
          </div>
          <SaveState saving={save.isPending} dirty={dirty} />
        </div>
        <div className="mb-2 flex justify-end">
          <NotesToolbar prefs={prefs} onBullet={() => insertBullet(areaRef.current, value, update)} />
        </div>
        <NotesTextarea
          textareaRef={areaRef}
          value={value}
          onChange={update}
          prefs={prefs}
          placeholder={"Notes for this visit…\nStart a line with * for a bullet"}
          className="min-h-[160px]"
        />
      </PopoverContent>
    </Popover>
  );
}
