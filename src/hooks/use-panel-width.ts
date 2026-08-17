import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Persists a resizable panel width per signed-in user (localStorage).
 */
export function usePanelWidth(panelKey: string, defaultWidth: number) {
  const [width, setWidth] = useState(defaultWidth);
  const storageKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const key = `panel-width:${data.user?.id ?? "anon"}:${panelKey}`;
      storageKey.current = key;
      const stored = window.localStorage.getItem(key);
      const parsed = stored ? Number(stored) : NaN;
      if (Number.isFinite(parsed)) setWidth(parsed);
    });
    return () => {
      cancelled = true;
    };
  }, [panelKey]);

  function persistWidth(next: number) {
    setWidth(next);
    if (storageKey.current) {
      window.localStorage.setItem(storageKey.current, String(next));
    }
  }

  return [width, persistWidth] as const;
}
