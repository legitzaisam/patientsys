import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { useIdentity } from "@/lib/use-identity";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const [ready, setReady] = useState(DEMO_MODE);

  useEffect(() => {
    if (DEMO_MODE) return;
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        // Use a hard navigation to avoid a client-side route transition that
        // triggers a hydration mismatch on /auth.
        window.location.replace("/auth");
      } else {
        setReady(true);
      }
    });

    // If the session disappears or expires while the app is open, stop
    // rendering protected children (their server calls would 401) and send
    // the user back to sign-in.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (!session) {
        setReady(false);
        window.location.replace("/auth");
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-deep border-t-transparent" />
      </div>
    );
  }

  return <IdentityGate />;
}

/**
 * Every page below reads identity and renders "Loading…" until it arrives, so a
 * failing getMe would leave them all spinning forever. Surfacing the failure
 * once here covers the whole authenticated tree.
 */
function IdentityGate() {
  const { error, isError, isFetching, refetch } = useIdentity();

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-card max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
            We could not load your account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Something went wrong reaching the clinic."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? "Retrying…" : "Try again"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void supabase.auth.signOut().then(() => window.location.replace("/auth"));
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
