import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GripVertical, StickyNote, X } from "lucide-react";
import { getMyNote, saveMyNote } from "@/lib/clinic.functions";
import { SaveState, useNotesPrefs } from "@/components/notes/ios-notes-editor";
import { RichNotesEditor } from "@/components/notes/rich-notes-editor";
import { Button } from "@/components/ui/button";
import { useIdentity } from "@/lib/use-identity";
import { cn } from "@/lib/utils";
import { getAppZoom } from "@/lib/app-zoom";
import { startPointerDrag } from "@/lib/pointer-drag";

/**
 * "My notes" as a movable, resizable floating card.
 *
 * Mounted once for the staff session so it stays put across pages. Drag the
 * header to move it anywhere on screen, including flush to the left or right.
 * Drag the right, bottom, or corner to resize. Position, size, and open state
 * persist in localStorage.
 */

const POS_KEY = "aetheria.notes-float-pos";
const SIZE_KEY = "aetheria.notes-float-size";
const OPEN_KEY = "aetheria.notes-float-open";
const TUCK_KEY = "aetheria.notes-float-tuck";

const MIN_W = 300;
const MIN_H = 260;
const EDGE_Y = 8;
const DEFAULT_W = 380;
const DEFAULT_H = 480;

type Pos = { x: number; y: number };
type Size = { w: number; h: number };
type ResizeEdge = "e" | "s" | "se";

type NotesFloatApi = {
  open: boolean;
  toggle: () => void;
};

const NotesFloatContext = createContext<NotesFloatApi | null>(null);

/** Viewport size in CSS pixels (the app may be zoomed — see src/lib/app-zoom.ts). */
function viewportCss() {
  const zoom = getAppZoom();
  return { w: window.innerWidth / zoom, h: window.innerHeight / zoom };
}

function clampSize(size: Size): Size {
  if (typeof window === "undefined") return size;
  const vp = viewportCss();
  return {
    w: Math.min(Math.max(MIN_W, size.w), Math.max(MIN_W, vp.w)),
    h: Math.min(Math.max(MIN_H, size.h), Math.max(MIN_H, vp.h - EDGE_Y * 2)),
  };
}

function clampPos(pos: Pos, size: Size): Pos {
  if (typeof window === "undefined") return pos;
  const { w, h } = clampSize(size);
  const vp = viewportCss();
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, vp.w - w)),
    y: Math.min(Math.max(EDGE_Y, pos.y), Math.max(EDGE_Y, vp.h - h - EDGE_Y)),
  };
}

function defaultPos(size: Size): Pos {
  if (typeof window === "undefined") return { x: 600, y: 80 };
  return clampPos({ x: viewportCss().w - size.w - 40, y: 64 }, size);
}

function loadSize(): Size {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Size;
      if (typeof parsed.w === "number" && typeof parsed.h === "number") return clampSize(parsed);
    }
  } catch {
    /* fall through */
  }
  return clampSize({ w: DEFAULT_W, h: DEFAULT_H });
}

function loadPos(size: Size): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Pos;
      if (typeof parsed.x === "number" && typeof parsed.y === "number") return clampPos(parsed, size);
    }
  } catch {
    /* fall through */
  }
  return defaultPos(size);
}

function persist(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function FloatingNotesProvider({ children }: { children: ReactNode }) {
  const { data: identity } = useIdentity();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(OPEN_KEY) === "1";
  });
  const [size, setSize] = useState<Size>(() => {
    if (typeof window === "undefined") return { w: DEFAULT_W, h: DEFAULT_H };
    return loadSize();
  });
  const [pos, setPos] = useState<Pos | null>(() => {
    if (typeof window === "undefined") return null;
    return loadPos(loadSize());
  });

  const sizeRef = useRef(size);
  sizeRef.current = size;


  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    localStorage.setItem(OPEN_KEY, "0");
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem(TUCK_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onWin = () => {
      setSize((current) => {
        const nextSize = clampSize(current);
        setPos((currentPos) => (currentPos ? clampPos(currentPos, nextSize) : currentPos));
        return nextSize;
      });
    };
    window.addEventListener("resize", onWin);
    return () => window.removeEventListener("resize", onWin);
  }, []);

  const savePlacement = () => {
    setSize((current) => {
      persist(SIZE_KEY, current);
      return current;
    });
    setPos((current) => {
      if (current) persist(POS_KEY, current);
      return current;
    });
  };

  function onDragHandleDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pos || (event.target as HTMLElement).closest("button, a, input, textarea")) return;
    const origin = pos;
    startPointerDrag(event, {
      onMove: (dx, dy) =>
        setPos(clampPos({ x: origin.x + dx, y: origin.y + dy }, sizeRef.current)),
      onEnd: savePlacement,
    });
  }

  function onResizeDown(edge: ResizeEdge) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!pos) return;
      event.stopPropagation();
      const origin = { w: size.w, h: size.h, x: pos.x, y: pos.y };
      startPointerDrag(event, {
        onMove: (dx, dy) => {
          const next = clampSize({
            w: edge === "s" ? origin.w : origin.w + dx,
            h: edge === "e" ? origin.h : origin.h + dy,
          });
          setSize(next);
          setPos(clampPos({ x: origin.x, y: origin.y }, next));
        },
        onEnd: savePlacement,
      });
    };
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const api = useMemo(() => ({ open, toggle }), [open, toggle]);
  const showPanel = Boolean(identity?.isStaff && open && pos && typeof document !== "undefined");

  return (
    <NotesFloatContext.Provider value={api}>
      {children}
      {showPanel && pos
        ? createPortal(
            <div
              role="dialog"
              aria-label="My notes"
              className="fixed z-[70]"
              style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
            >
              <div className="glass-card relative flex h-full flex-col p-0 !bg-[rgba(255,255,255,0.94)] shadow-[var(--shadow-popover)]">
                <div
                  onPointerDown={onDragHandleDown}
                  className="drag-handle flex shrink-0 cursor-grab items-center gap-1.5 border-b border-edge-2 px-4 py-3 active:cursor-grabbing"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">My notes</p>
                  <p className="ml-2 hidden min-w-0 truncate text-2xs text-muted-foreground sm:block">
                    Private to you · saves automatically
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close notes"
                    className="ml-auto rounded-full p-[5px] text-muted-foreground hover:bg-glass-2 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                  <FloatingNotesBody />
                </div>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize notes width"
                  onPointerDown={onResizeDown("e")}
                  className="drag-handle absolute inset-y-3 right-0 z-10 w-2 cursor-ew-resize touch-none pointer-coarse:w-4"
                />
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="Resize notes height"
                  onPointerDown={onResizeDown("s")}
                  className="drag-handle absolute inset-x-3 bottom-0 z-10 h-2 cursor-ns-resize touch-none pointer-coarse:h-4"
                />
                <div
                  role="separator"
                  aria-label="Resize notes"
                  onPointerDown={onResizeDown("se")}
                  className="drag-handle absolute bottom-0 right-0 z-20 flex h-5 w-5 cursor-nwse-resize touch-none pointer-coarse:h-8 pointer-coarse:w-8 items-end justify-end p-1"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-br-sm border-b-2 border-r-2 border-ink-3/45"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </NotesFloatContext.Provider>
  );
}

export function FloatingNotes({ triggerClassName }: { triggerClassName?: string } = {}) {
  const ctx = useContext(NotesFloatContext);
  const open = ctx?.open ?? false;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => ctx?.toggle()}
      aria-pressed={open}
      aria-label="My notes"
      title="My notes"
      className={cn("relative h-9 w-9", open && "text-accent-ink", triggerClassName)}
    >
      <StickyNote className="h-4 w-4" aria-hidden />
    </Button>
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
    <div className="flex min-h-0 flex-1 flex-col">
      {value !== null ? (
        <RichNotesEditor
          fill
          value={value}
          onChange={(v) => {
            setValue(v);
            setDirty(true);
          }}
          prefs={prefs}
        />
      ) : (
        <div className="min-h-[140px] flex-1 rounded-2xl bg-glass-2 p-3.5 text-sm text-muted-foreground">
          Loading…
        </div>
      )}
      <div className="mt-2 flex shrink-0 justify-start pl-1.5">
        <SaveState saving={save.isPending} dirty={dirty} />
      </div>
    </div>
  );
}
