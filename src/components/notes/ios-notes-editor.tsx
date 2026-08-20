import { useEffect, useRef, useState } from "react";
import { Check, Loader2, List, Minus, Plus, Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const BULLET = "•\u00A0";

/** Turn a line starting with "* " (or "- ") into an iOS-style bullet. */
export function autoBullet(text: string, caret: number): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const lineStart = before.lastIndexOf("\n") + 1;
  const line = before.slice(lineStart);
  const m = /^(\s*)([*-])\s$/.exec(line);
  if (!m) return { text, caret };
  const replacement = `${m[1]}${BULLET}`;
  const next = text.slice(0, lineStart) + replacement + text.slice(caret);
  return { text: next, caret: lineStart + replacement.length };
}

/** Continue or end a bullet list when Enter / Backspace is pressed. */
export function bulletKeydown(
  text: string,
  caret: number,
  key: "Enter" | "Backspace",
): { text: string; caret: number } | null {
  const before = text.slice(0, caret);
  const lineStart = before.lastIndexOf("\n") + 1;
  const line = before.slice(lineStart);
  const m = new RegExp(`^(\\s*)${BULLET}(.*)$`).exec(line);
  if (!m) return null;
  const indent = m[1] ?? "";
  const rest = m[2] ?? "";
  if (key === "Enter") {
    if (rest.trim() === "") {
      // empty bullet -> exit the list
      const next = text.slice(0, lineStart) + text.slice(caret);
      return { text: next, caret: lineStart };
    }
    const insert = `\n${indent}${BULLET}`;
    return { text: text.slice(0, caret) + insert + text.slice(caret), caret: caret + insert.length };
  }
  // Backspace right after the bullet marker removes the whole marker
  if (line === `${indent}${BULLET}`) {
    const next = text.slice(0, lineStart + indent.length) + text.slice(caret);
    return { text: next, caret: lineStart + indent.length };
  }
  return null;
}

export type NotesTheme = "paper" | "cream" | "graphite";

const THEMES: Record<NotesTheme, { label: string; surface: string; text: string; rule: string }> = {
  paper: { label: "Paper", surface: "bg-glass-2", text: "text-foreground", rule: "border-glass-line" },
  cream: { label: "Cream", surface: "bg-accent-wash", text: "text-foreground", rule: "border-accent-line" },
  graphite: { label: "Graphite", surface: "bg-foreground/[0.06]", text: "text-foreground", rule: "border-foreground/15" },
};

const FONTS = {
  sans: { label: "System", cls: "font-sans" },
  // --font-serif is aliased to the display sans, so name a real serif stack here.
  serif: { label: "Serif", cls: "[font-family:ui-serif,Georgia,serif]" },
  mono: { label: "Mono", cls: "font-mono" },
} as const;
type NotesFont = keyof typeof FONTS;

export function useNotesPrefs(storageKey: string) {
  const [size, setSize] = useState(14);
  const [theme, setTheme] = useState<NotesTheme>("paper");
  const [font, setFont] = useState<NotesFont>("sans");
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.size) setSize(p.size);
        if (p.theme) setTheme(p.theme);
        if (p.font) setFont(p.font);
      }
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ size, theme, font }));
    } catch {
      /* ignore */
    }
  }, [storageKey, size, theme, font]);

  return { size, setSize, theme, setTheme, font, setFont };
}

export function NotesToolbar({
  prefs,
  onBullet,
}: {
  prefs: ReturnType<typeof useNotesPrefs>;
  onBullet: () => void;
}) {
  const btn =
    "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent-wash hover:text-foreground";
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={btn} title="Bullet list" onClick={onBullet}>
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={btn}
        title="Smaller text"
        onClick={() => prefs.setSize(Math.max(11, prefs.size - 1))}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={btn}
        title="Larger text"
        onClick={() => prefs.setSize(Math.min(22, prefs.size + 1))}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={btn} title="Paper & font">
            <Palette className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 rounded-2xl">
          <DropdownMenuLabel className="text-2xs tracking-[0.02em]">Paper</DropdownMenuLabel>
          {(Object.keys(THEMES) as NotesTheme[]).map((t) => (
            <DropdownMenuItem key={t} className="text-xs" onClick={() => prefs.setTheme(t)}>
              <span className={`mr-2 h-3 w-3 rounded-full border ${THEMES[t].surface} ${THEMES[t].rule}`} />
              {THEMES[t].label}
              {prefs.theme === t ? <Check className="ml-auto h-3 w-3 text-success" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-2xs tracking-[0.02em]">Font</DropdownMenuLabel>
          {(Object.keys(FONTS) as NotesFont[]).map((f) => (
            <DropdownMenuItem key={f} className={`text-xs ${FONTS[f].cls}`} onClick={() => prefs.setFont(f)}>
              {FONTS[f].label}
              {prefs.font === f ? <Check className="ml-auto h-3 w-3 text-success" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function NotesTextarea({
  value,
  onChange,
  prefs,
  placeholder,
  className,
  textareaRef,
  autoGrow = false,
}: {
  value: string;
  onChange: (v: string) => void;
  prefs: ReturnType<typeof useNotesPrefs>;
  placeholder?: string;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  autoGrow?: boolean;
}) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? innerRef;
  const pendingCaret = useRef<number | null>(null);

  useEffect(() => {
    if (pendingCaret.current != null && ref.current) {
      ref.current.selectionStart = ref.current.selectionEnd = pendingCaret.current;
      pendingCaret.current = null;
    }
  });

  useEffect(() => {
    if (!autoGrow || !ref.current) return;
    const el = ref.current;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoGrow, value, prefs.size, prefs.font, ref]);

  const theme = THEMES[prefs.theme];

  return (
    <textarea
      ref={ref}
      value={value}
      spellCheck
      rows={autoGrow ? 3 : undefined}
      onChange={(e) => {
        const res = autoBullet(e.target.value, e.target.selectionStart ?? 0);
        pendingCaret.current = res.caret;
        onChange(res.text);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== "Backspace") return;
        const el = e.currentTarget;
        if (el.selectionStart !== el.selectionEnd) return;
        const res = bulletKeydown(el.value, el.selectionStart, e.key);
        if (!res) return;
        e.preventDefault();
        pendingCaret.current = res.caret;
        onChange(res.text);
      }}
      placeholder={placeholder}
      style={{ fontSize: prefs.size, lineHeight: 1.65 }}
      className={`${autoGrow ? "h-auto overflow-hidden" : "flex-1"} resize-none rounded-2xl border ${theme.rule} ${theme.surface} ${theme.text} ${FONTS[prefs.font].cls} p-3.5 outline-none transition-colors placeholder:text-muted-foreground focus:border-accent-line ${className ?? ""}`}
    />
  );
}

export function SaveState({ saving, dirty }: { saving: boolean; dirty: boolean }) {
  return (
    <span className="text-2xs text-muted-foreground">
      {saving ? (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving
        </span>
      ) : dirty ? (
        "Unsaved"
      ) : (
        <span className="inline-flex items-center gap-1 text-success">
          <Check className="h-3 w-3" /> Saved
        </span>
      )}
    </span>
  );
}

/** Insert a bullet marker at the caret of the given textarea. */
export function insertBullet(
  el: HTMLTextAreaElement | null,
  value: string,
  onChange: (v: string) => void,
) {
  if (!el) return;
  const caret = el.selectionStart ?? value.length;
  const before = value.slice(0, caret);
  const lineStart = before.lastIndexOf("\n") + 1;
  const atLineStart = caret === lineStart;
  const insert = `${atLineStart ? "" : "\n"}${BULLET}`;
  const next = value.slice(0, caret) + insert + value.slice(caret);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    el.selectionStart = el.selectionEnd = caret + insert.length;
  });
}
