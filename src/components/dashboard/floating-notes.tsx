import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GripVertical, StickyNote, X } from "lucide-react";
import { getMyNote, saveMyNote } from "@/lib/clinic.functions";
import { SaveState, useNotesPrefs } from "@/components/notes/ios-notes-editor";
import { RichNotesEditor } from "@/components/notes/rich-notes-editor";

/**
 * "My notes" as a movable floating card.
 *
 * The dashboard used to pin notes as a right-hand sidebar; that space now
 * belongs to Safe-to-proceed. Notes live behind a header icon instead: the
 * card floats above the page, drags by its header (QuickAdd's offset pattern)
 * and remembers both its position and whether it was open.
 */

const CARD_W = 380;
const POS_KEY = "aetheria.notes-float-pos";
const OPEN_KEY = "aetheria.notes-float-open";

type Pos = { x: number; y: number };

function clampPos(pos: Pos): Pos {
  if (typeof window === "undefined") return pos;
  return {
    x: Math.min(Math.max(8, pos.x), window.innerWidth - CARD_W - 8),
    y: Math.min(Math.max(64, pos.y), window.innerHeight - 160),
  };
}

function defaultPos(): Pos {
  if (typeof window === "undefined") return { x: 600, y: 120 };
  return clampPos({ x: window.innerWidth - CARD_W - 40, y: 118 });
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Pos;
      if (typeof parsed.x === "number" && typeof parsed.y === "number") return clampPos(parsed);
    }
  } catch {
    /* fall through to default */
  }
  return defaultPos();
}

export function FloatingNotes() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Restore persisted state after mount (SSR-safe).
  useEffect(() => {
    setPos(loadPos());
    if (localStorage.getItem(OPEN_KEY) === "1") setOpen(true);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    localStorage.setItem(OPEN_KEY, next ? "1" : "0");
  }

  function onDragHandleDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pos || (event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startY: event.clientY, origX: pos.x, origY: pos.y };
    document.body.classList.add("select-none");

    function onMove(moveEvent: globalThis.PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      setPos(
        clampPos({
          x: drag.origX + (moveEvent.clientX - drag.startX),
          y: drag.origY + (moveEvent.clientY - drag.startY),
        }),
      );
    }

    function onUp() {
      dragRef.current = null;
      document.body.classList.remove("select-none");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setPos((current) => {
        if (current) localStorage.setItem(POS_KEY, JSON.stringify(current));
        return current;
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        localStorage.setItem(OPEN_KEY, "0");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={open}
        aria-label="My notes"
        title="My notes"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-edge shadow-inset-hi transition-colors ${
          open ? "bg-accent-soft text-accent-ink" : "bg-glass-2 text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground"
        }`}
      >
        <StickyNote className="h-4 w-4" aria-hidden />
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-label="My notes"
              className="fixed z-[70]"
              style={{ left: pos.x, top: pos.y, width: CARD_W }}
            >
              <div className="glass-card flex max-h-[70vh] flex-col p-0 shadow-[var(--shadow-popover)]">
                <div
                  onPointerDown={onDragHandleDown}
                  className="flex cursor-grab items-center gap-1.5 border-b border-edge-2 px-4 py-3 active:cursor-grabbing"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">My notes</p>
                  <p className="ml-2 hidden text-2xs text-muted-foreground sm:block">Private to you · saves automatically</p>
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label="Close notes"
                    className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-glass-2 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <FloatingNotesBody />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function FloatingNotesBody() {
  const fetchNote = useServerFn(getMyNote);
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-note"], queryFn: () => fetchNote() });
  const [value, setValue] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const prefs = useNotesPrefs("notes-prefs:my-notes");
  const valueRef = useRef(value);
  const dirtyRef = useRef(dirty);
  const saveFn = useServerFn(saveMyNote);

  useEffect(() => {
    valueRef.current = value;
    dirtyRef.current = dirty;
  }, [value, dirty]);

  useEffect(() => {
    if (data && value === null) setValue(data.body ?? "");
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

  // Flush pending edits when the card unmounts or the page hides.
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

  return (
    <>
      {value !== null ? (
        <RichNotesEditor
          value={value}
          onChange={(v) => {
            setValue(v);
            setDirty(true);
          }}
          prefs={prefs}
        />
      ) : (
        <div className="min-h-[140px] rounded-2xl bg-glass-2 p-3.5 text-sm text-muted-foreground">Loading…</div>
      )}
      <div className="mt-2 flex justify-start pl-1.5">
        <SaveState saving={save.isPending} dirty={dirty} />
      </div>
    </>
  );
}
