import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { STAFF_IDLE_MS } from "@/lib/auth/constants";

/**
 * Reception machines are shared. After 1 hour 15 minutes with no pointer, key
 * or scroll activity, sign the staff session out. Patients are on personal
 * devices and are not timed out here.
 */
export function IdleWatchdog({ enabled }: { enabled: boolean }) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || DEMO_MODE) return;

    const bump = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void supabase.auth.signOut().finally(() => {
          window.location.replace("/auth?idle=1");
        });
      }, STAFF_IDLE_MS);
    };

    bump();
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll"];
    for (const event of events) window.addEventListener(event, bump, { passive: true });
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      for (const event of events) window.removeEventListener(event, bump);
    };
  }, [enabled]);

  return null;
}
