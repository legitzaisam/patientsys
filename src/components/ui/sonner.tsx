import { useEffect } from "react";
import {
  AlertTriangle,
  Check,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { toast, Toaster as Sonner } from "sonner";
import { cn } from "@/lib/utils";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const pinnedToastIds = new Set<string | number>();

/** Pin a toast so it stays on screen until explicitly closed. */
export function pinAetheriaToast(id: string | number) {
  pinnedToastIds.add(id);
  for (const el of document.querySelectorAll("[data-sonner-toast]")) {
    if (toastIdFromElement(el) === id) {
      el.classList.add("aetheria-toast-pinned");
    }
  }
}

export function unpinAetheriaToast(id: string | number) {
  pinnedToastIds.delete(id);
}

function ToastIcon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-inset-hi",
        className,
      )}
    >
      {children}
    </span>
  );
}

function syncPinnedSet() {
  const live = new Set(toast.getToasts().map((t) => t.id));
  for (const id of [...pinnedToastIds]) {
    if (!live.has(id)) pinnedToastIds.delete(id);
  }
}

/** Sonner renders newest first (data-index 0); getToasts() is oldest→newest. */
function toastIdFromElement(el: Element): string | number | null {
  const index = Number(el.getAttribute("data-index"));
  if (!Number.isFinite(index) || index < 0) return null;
  const active = toast.getToasts();
  const match = active[active.length - 1 - index];
  return match?.id ?? null;
}

function isQuickReplyToast(toastEl: Element, id: string | number | null) {
  if (toastEl.classList.contains("aetheria-quick-reply-toast")) return true;
  if (toastEl.querySelector("[data-aetheria-quick-reply]")) return true;
  if (id != null && String(id).startsWith("team-alert-")) return true;
  return false;
}

function pinToast(id: string | number) {
  const current = toast.getToasts().find((t) => t.id === id);
  if (!current) return;
  // Never recreate custom/jsx toasts — that replaces them with an empty message toast.
  if ("jsx" in current && current.jsx) return;
  if (String(id).startsWith("team-alert-")) return;

  const title =
    typeof current.title === "function" ? current.title() : (current.title ?? "");
  const description =
    typeof current.description === "function"
      ? current.description()
      : current.description;

  const options = {
    id,
    duration: Infinity,
    description,
    action: current.action,
    cancel: current.cancel,
    icon: current.icon,
    closeButton: current.closeButton,
    className: cn(current.className, "aetheria-toast-pinned"),
    onDismiss: () => {
      pinnedToastIds.delete(id);
    },
    onAutoClose: () => {
      pinnedToastIds.delete(id);
    },
  };

  pinnedToastIds.add(id);

  switch (current.type) {
    case "success":
      toast.success(title, options);
      break;
    case "error":
      toast.error(title, options);
      break;
    case "warning":
      toast.warning(title, options);
      break;
    case "info":
      toast.info(title, options);
      break;
    case "loading":
      toast.loading(title, options);
      break;
    default:
      toast.message(title, options);
      break;
  }
}

function useToastPinning() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Our in-toast close control handles dismiss itself.
      if (target.closest("[data-aetheria-quick-reply-close], [data-aetheria-quick-reply-minimize], [data-aetheria-quick-reply-slide]")) return;

      const toastEl = target.closest("[data-sonner-toast]") as HTMLElement | null;
      if (!toastEl || toastEl.getAttribute("data-removed") === "true") return;
      if (toastEl.getAttribute("data-swiped") === "true") return;

      const id = toastIdFromElement(toastEl);

      // Quick-reply chat toasts: never dismiss on body/button clicks — × only.
      if (isQuickReplyToast(toastEl, id)) {
        if (id != null) pinAetheriaToast(id);
        return;
      }

      if (target.closest("[data-button], [data-close-button], a, button, textarea, input, label")) {
        return;
      }

      syncPinnedSet();
      if (id == null) return;

      // Already pinned: leave it alone (do not dismiss on second click).
      if (pinnedToastIds.has(id) || toastEl.classList.contains("aetheria-toast-pinned")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      pinToast(id);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Let open dialogs / menus own Escape first.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (document.querySelector('[role="menu"][data-state="open"]')) return;
      if (document.querySelector('[role="listbox"][data-state="open"]')) return;

      // Quick-reply toasts only close via × — not Escape.
      const hasQuickReply = document.querySelector(
        "[data-sonner-toast].aetheria-quick-reply-toast, [data-aetheria-quick-reply]",
      );
      if (hasQuickReply) {
        // Still allow Escape to clear *other* pinned toasts, but never quick-reply ones.
        syncPinnedSet();
        event.preventDefault();
        for (const id of [...pinnedToastIds]) {
          if (String(id).startsWith("team-alert-")) continue;
          const row = toast.getToasts().find((t) => t.id === id);
          if (row && "jsx" in row && row.jsx) continue;
          toast.dismiss(id);
          pinnedToastIds.delete(id);
        }
        return;
      }

      syncPinnedSet();
      if (pinnedToastIds.size === 0) return;

      event.preventDefault();
      for (const id of [...pinnedToastIds]) {
        toast.dismiss(id);
      }
      pinnedToastIds.clear();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
}

const Toaster = ({ ...props }: ToasterProps) => {
  useToastPinning();

  return (
    <Sonner
      className="toaster group"
      position="bottom-left"
      offset={24}
      gap={12}
      expand
      visibleToasts={4}
      closeButton
      style={{
        zIndex: 100,
        ["--width" as string]: "20rem",
        ["--border-radius" as string]: "22px",
        fontFamily: "var(--font-sans)",
      }}
      icons={{
        success: (
          <ToastIcon className="border-success/25 bg-success-bg text-success-ink">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </ToastIcon>
        ),
        error: (
          <ToastIcon className="border-destructive/25 bg-destructive-bg text-destructive-ink">
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </ToastIcon>
        ),
        warning: (
          <ToastIcon className="border-warning/30 bg-warning-bg text-warning-ink">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} />
          </ToastIcon>
        ),
        info: (
          <ToastIcon className="border-sky/30 bg-sky-bg text-sky-ink">
            <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
          </ToastIcon>
        ),
        loading: (
          <ToastIcon className="border-edge bg-glass-2 text-ink-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </ToastIcon>
        ),
        close: <X className="h-3.5 w-3.5" strokeWidth={2.25} />,
      }}
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast aetheria-toast !w-[20rem] cursor-pointer",
            "border border-edge bg-[rgba(255,255,255,0.78)] text-foreground shadow-popover",
            "backdrop-blur-sm rounded-[22px]",
            "!font-sans",
          ),
          title:
            "!m-0 !text-sm !font-semibold !tracking-[-0.012em] !text-foreground !leading-snug",
          description: "!text-[13px] !leading-snug !text-foreground/85 !mt-1",
          content: "!m-0 !min-w-0",
          icon: "!m-0 !h-auto !w-auto",
          closeButton: cn(
            "aetheria-toast-close",
            "!left-auto !right-2.5 !top-1/2 !h-7 !w-7 !rounded-full",
            "!border-edge !bg-glass-2 !text-ink-3 !shadow-inset-hi",
            "hover:!border-edge-2 hover:!bg-[rgba(47,63,102,0.08)] hover:!text-foreground",
            "transition-colors",
          ),
          actionButton: cn(
            "!h-8 !rounded-full !px-3 !text-2xs !font-semibold",
            "!border !border-accent-line !bg-accent-soft !text-accent-ink !shadow-inset-hi",
            "hover:!brightness-[0.97]",
          ),
          cancelButton: cn(
            "!h-8 !rounded-full !px-3 !text-2xs !font-semibold",
            "!border !border-edge !bg-glass-2 !text-muted-foreground !shadow-inset-hi",
            "hover:!border-edge-2 hover:!text-foreground",
          ),
          success: "aetheria-toast--success",
          error: "aetheria-toast--error",
          warning: "aetheria-toast--warning",
          info: "aetheria-toast--info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
