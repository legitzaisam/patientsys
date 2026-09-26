import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "owner", label: "Clinic owner", who: "Dr Amara Osei" },
  { value: "practitioner", label: "Practitioner", who: "Dr Nadia Rahman" },
  { value: "front_desk", label: "Front desk", who: "Sofia Marchetti" },
  { value: "patient", label: "Patient", who: "Olivia Bennett" },
  { value: "admin", label: "Software admin", who: "Software developer" },
] as const;

function readCookie() {
  const value = /(?:^|;\s*)demo_role=([^;]+)/.exec(document.cookie)?.[1];
  return ROLES.some((r) => r.value === value) ? value! : "owner";
}

/** Demo-only persona switcher so every role's view can be captured without signing in. */
export function DemoRoleSwitcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [role, setRole] = useState("owner");
  const [open, setOpen] = useState(false);

  useEffect(() => setRole(readCookie()), []);

  async function choose(next: string) {
    document.cookie = `demo_role=${next}; path=/; max-age=86400; samesite=lax`;
    setRole(next);
    setOpen(false);
    queryClient.clear();
    await router.invalidate();
    if (next === "patient") router.navigate({ to: "/my-record" });
    else if (window.location.pathname === "/my-record" || (window.location.pathname === "/access" && next !== "admin")) {
      router.navigate({ to: "/dashboard" });
    }
  }

  const current = ROLES.find((r) => r.value === role) ?? ROLES[0];

  // Bottom-left: the floating dock (alert + chat bubbles) owns bottom-right.
  // On a phone the bottom corners are full, so the pill sits in the toolbar
  // row next to the sidebar button and its menu opens downwards.
  return (
    <div className="fixed z-40 print:hidden max-sm:left-[3.75rem] max-sm:top-2 max-sm:flex max-sm:flex-col-reverse max-sm:items-start sm:bottom-5 sm:left-5">
      {open && (
        <div className="glass-card w-56 overflow-hidden max-sm:mt-2 sm:mb-2">
          <p className="border-b border-edge px-3 py-2 text-2xs tracking-[0.02em] text-muted-foreground">
            View the app as
          </p>
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => void choose(r.value)}
              className={cn(
                "flex w-full flex-col items-start rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(47,63,102,0.08)]",
                r.value === role && "bg-[rgba(47,63,102,0.08)]",
              )}
            >
              <span className="text-foreground">{r.label}</span>
              <span className="text-xs text-muted-foreground">{r.who}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-edge bg-glass px-3 text-sm shadow-glass backdrop-blur-glass transition-colors hover:bg-card sm:h-auto sm:px-4 sm:py-2"
      >
        <span className="h-2 w-2 rounded-full bg-accent" />
        <span className="text-muted-foreground">
          Demo<span className="max-sm:hidden">:</span>
        </span>
        <span className="text-foreground max-sm:hidden">{current.label}</span>
      </button>
    </div>
  );
}
