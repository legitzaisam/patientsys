import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";

export function useAuthSessionReady() {
  const [ready, setReady] = useState(DEMO_MODE);

  useEffect(() => {
    if (DEMO_MODE) return;
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setReady(Boolean(data.session?.access_token));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setReady(Boolean(session?.access_token));
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return ready;
}