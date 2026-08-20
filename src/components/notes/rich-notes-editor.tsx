import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Link2,
  Link2Off,
  Undo2,
  Redo2,
  Palette,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNotesPrefs, type NotesTheme } from "@/components/notes/ios-notes-editor";

const THEMES: Record<NotesTheme, { label: string; surface: string; text: string; rule: string }> = {
  paper: { label: "Paper", surface: "bg-glass-2", text: "text-foreground", rule: "border-glass-line" },
  cream: { label: "Cream", surface: "bg-accent-wash", text: "text-foreground", rule: "border-accent-line" },
  graphite: { label: "Graphite", surface: "bg-foreground/[0.06]", text: "text-foreground", rule: "border-foreground/15" },
};

const FONTS = {
  sans: { label: "System", cls: "font-sans" },
  serif: { label: "Serif", cls: "[font-family:ui-serif,Georgia,serif]" },
  mono: { label: "Mono", cls: "font-mono" },
} as const;

/** Convert legacy plain-text notes into a TipTap HTML paragraph. */
export function toEditorHtml(body: string) {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<p>${escaped}</p>`;
}

/** Treat empty TipTap shells as blank for storage. */
export function normalizeNoteHtml(html: string) {
  const plain = html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
  return plain ? html : "";
}

type Prefs = ReturnType<typeof useNotesPrefs>;

export function RichNotesEditor({
  value,
  onChange,
  prefs,
  placeholder = "Jot down reminders, handover notes or things to follow up…",
}: {
  value: string;
  onChange: (html: string) => void;
  prefs: Prefs;
  placeholder?: string;
}) {
  const theme = THEMES[prefs.theme];
  const lastEmitted = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-accent-ink underline underline-offset-2" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        class: cn(
          "rich-notes max-h-[min(70vh,36rem)] min-h-[140px] overflow-y-auto px-3.5 py-3 outline-none",
          theme.text,
          FONTS[prefs.font].cls,
        ),
        style: `font-size: ${prefs.size}px; line-height: 1.65`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const next = normalizeNoteHtml(ed.getHTML());
      lastEmitted.current = next;
      onChange(next);
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(toEditorHtml(value) || "", { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    (editor.view.dom as HTMLElement).style.fontSize = `${prefs.size}px`;
  }, [editor, prefs.size]);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes("link")["href"] as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const btn =
    "inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground disabled:opacity-30";
  const active = "bg-accent-soft text-accent-ink shadow-inset-hi";

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-glass-line pb-2">
        <ToolbarButton
          className={cn(btn, editor.isActive("bold") && active)}
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          className={cn(btn, editor.isActive("italic") && active)}
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          className={cn(btn, editor.isActive("underline") && active)}
          title="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          className={cn(btn, editor.isActive("strike") && active)}
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        <ToolbarButton
          className={cn(btn, editor.isActive("heading", { level: 2 }) && active)}
          title="Heading"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          className={cn(btn, editor.isActive("heading", { level: 3 }) && active)}
          title="Subheading"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        <ToolbarButton
          className={cn(btn, editor.isActive("bulletList") && active)}
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          className={cn(btn, editor.isActive("orderedList") && active)}
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          className={cn(btn, editor.isActive("taskList") && active)}
          title="Checklist"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListChecks className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          className={cn(btn, editor.isActive("blockquote") && active)}
          title="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          className={btn}
          title="Divider"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        <ToolbarButton
          className={cn(btn, editor.isActive("link") && active)}
          title="Add link"
          onClick={setLink}
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          className={btn}
          title="Remove link"
          disabled={!editor.isActive("link")}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Link2Off className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        <ToolbarButton
          className={btn}
          title="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          className={btn}
          title="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarButton
            className={btn}
            title="Smaller text"
            onClick={() => prefs.setSize(Math.max(12, prefs.size - 1))}
          >
            <span className="text-[10px] font-semibold">A</span>
          </ToolbarButton>
          <ToolbarButton
            className={btn}
            title="Larger text"
            onClick={() => prefs.setSize(Math.min(22, prefs.size + 1))}
          >
            <Plus className="h-3 w-3" />
          </ToolbarButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={btn} title="Paper & font">
                <Palette className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Paper</DropdownMenuLabel>
              {(Object.keys(THEMES) as NotesTheme[]).map((key) => (
                <DropdownMenuItem key={key} onClick={() => prefs.setTheme(key)}>
                  {THEMES[key].label}
                  {prefs.theme === key ? " ·" : ""}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Font</DropdownMenuLabel>
              {(Object.keys(FONTS) as (keyof typeof FONTS)[]).map((key) => (
                <DropdownMenuItem key={key} onClick={() => prefs.setFont(key)}>
                  {FONTS[key].label}
                  {prefs.font === key ? " ·" : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={cn("rounded-2xl border transition-colors", theme.rule, theme.surface)}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  className,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={className} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-4 w-px bg-edge-2" aria-hidden />;
}
