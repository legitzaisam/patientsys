import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { NotebookPen } from "lucide-react";
import { getMyNote, saveMyNote } from "@/lib/clinic.functions";
import {
  NotesTextarea,
  NotesToolbar,
  SaveState,
  insertBullet,
  useNotesPrefs,
} from "@/components/notes/ios-notes-editor";

export function NotesPanel() {
  const fetchNote = useServerFn(getMyNote);
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-note"], queryFn: () => fetchNote() });
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const hydrated = useRef(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const prefs = useNotesPrefs("notes-prefs:my-notes");

  useEffect(() => {
    if (data && !hydrated.current) {
      setValue(data.body ?? "");
      hydrated.current = true;
    }
  }, [data]);

  const save = useMutation({
    mutationFn: useServerFn(saveMyNote),
    onSuccess: (res) => {
      setDirty(false);
      queryClient.setQueryData(["my-note"], res);
    },
  });

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => save.mutate({ data: { body: value } }), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, dirty]);

  const update = (v: string) => {
    setValue(v);
    setDirty(true);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.016em] text-foreground">
          <NotebookPen className="h-4 w-4 text-muted-foreground" />
          My notes
        </h2>
        <p className="text-xs text-muted-foreground">Private to you · saves automatically.</p>
      </div>
      <div className="glass-card flex flex-1 flex-col p-4">
        <NotesTextarea
          textareaRef={areaRef}
          value={value}
          onChange={update}
          prefs={prefs}
          placeholder="Jot down reminders, handover notes or things to follow up…"
          className="min-h-[220px]"
        />
        <div className="mt-2 flex scale-95 origin-left items-center justify-between gap-2">
          <NotesToolbar prefs={prefs} onBullet={() => insertBullet(areaRef.current, value, update)} />
          <SaveState saving={save.isPending} dirty={dirty} />
        </div>
      </div>
    </div>
  );
}
