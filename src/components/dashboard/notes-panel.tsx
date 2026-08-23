import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyNote, saveMyNote } from "@/lib/clinic.functions";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { SaveState, useNotesPrefs } from "@/components/notes/ios-notes-editor";
import { RichNotesEditor } from "@/components/notes/rich-notes-editor";

const DEFAULT_W = 340;
const MIN_W = 240;
const MAX_W = 640;

function clampWidth(value: number) {
  return Math.min(MAX_W, Math.max(MIN_W, Math.round(value)));
}

export function NotesPanel() {
  const fetchNote = useServerFn(getMyNote);
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-note"], queryFn: () => fetchNote() });
  const [value, setValue] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const prefs = useNotesPrefs("notes-prefs:my-notes");
  const [width, setWidth] = usePanelWidth("dashboard-notes-w", DEFAULT_W);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const valueRef = useRef(value);
  const dirtyRef = useRef(dirty);
  const saveFn = useServerFn(saveMyNote);

  useEffect(() => {
    valueRef.current = value;
    dirtyRef.current = dirty;
  }, [value, dirty]);

  useEffect(() => {
    if (data && value === null) {
      setValue(data.body ?? "");
    }
  }, [data, value]);

  const save = useMutation({
    mutationFn: saveFn,
    onSuccess: (res) => {
      setDirty(false);
      queryClient.setQueryData(["my-note"], res);
    },
  });

  useEffect(() => {
    if (!dirty || value === null) return;
    const t = setTimeout(() => save.mutate({ data: { body: value } }), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, dirty]);

  // Flush pending edits when leaving the page / unmounting.
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current || valueRef.current === null) return;
      void saveFn({ data: { body: valueRef.current } });
      dirtyRef.current = false;
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
  }, [saveFn]);

  const update = (v: string) => {
    setValue(v);
    setDirty(true);
  };

  function onResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: width };
    document.body.classList.add("select-none", "cursor-col-resize");

    function onMove(moveEvent: globalThis.PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      setWidth(clampWidth(drag.startWidth + (drag.startX - moveEvent.clientX)));
    }

    function onUp() {
      dragRef.current = null;
      document.body.classList.remove("select-none", "cursor-col-resize");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <aside
      className="flex w-full shrink-0 flex-col lg:sticky lg:top-14 lg:w-[var(--notes-w)] lg:self-start"
      style={{ ["--notes-w" as string]: `${clampWidth(width)}px` }}
    >
      <div className="mb-4 shrink-0">
        <h2 className="section-title">My notes</h2>
        <p className="text-xs text-muted-foreground">Private to you · saves automatically.</p>
      </div>
      <div className="glass-card relative flex min-h-[180px] flex-col p-4">
        {value !== null ? (
          <RichNotesEditor value={value} onChange={update} prefs={prefs} />
        ) : (
          <div className="min-h-[140px] rounded-2xl bg-glass-2 p-3.5 text-sm text-muted-foreground">Loading…</div>
        )}
        <div className="mt-2 flex justify-start pl-1.5">
          <SaveState saving={save.isPending} dirty={dirty} />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize notes width"
          aria-valuemin={MIN_W}
          aria-valuemax={MAX_W}
          aria-valuenow={clampWidth(width)}
          tabIndex={0}
          onPointerDown={onResizePointerDown}
          onDoubleClick={() => setWidth(DEFAULT_W)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setWidth(clampWidth(width + 16));
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setWidth(clampWidth(width - 16));
            }
          }}
          className="absolute inset-y-3 left-0 z-10 hidden w-3 cursor-col-resize touch-none lg:block after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-px after:rounded-full hover:after:bg-accent-soft"
        />
      </div>
    </aside>
  );
}
