import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "owner", label: "Clinic owner", who: "Dr Amara Osei" },
  { value: "practitioner", label: "Practitioner", who: "Dr Nadia Rahman" },
  { value: "front_desk", label: "Front desk", who: "Sofia Marchetti" },
  { value: "patient", label: "Patient", who: "Olivia Bennett" },
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
    else if (window.location.pathname === "/my-record") router.navigate({ to: "/dashboard" });
  }

  const current = ROLES.find((r) => r.value === role) ?? ROLES[0];

  return (
    <div className="fixed bottom-5 right-5 z-50 print:hidden">
      {open && (
        <div className="glass-card mb-2 w-56 overflow-hidden">
          <p className="border-b border-edge px-3 py-2 text-2xs tracking-[0.02em] text-muted-foreground">
            View the app as
          </p>
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => void choose(r.value)}
              className={cn(
                "flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-glass-2",
                r.value === role && "bg-glass-2",
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
        className="flex cursor-pointer items-center gap-2 rounded-full border border-edge bg-glass px-4 py-2 text-sm shadow-glass backdrop-blur-glass transition-colors hover:bg-card"
      >
        <span className="h-2 w-2 rounded-full bg-accent" />
        <span className="text-muted-foreground">Demo:</span>
        <span className="text-foreground">{current.label}</span>
      </button>
    </div>
  );
}
