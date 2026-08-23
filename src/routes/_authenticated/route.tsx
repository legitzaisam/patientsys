import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ForcePasswordChangeGate,
  StaffWelcomeDialog,
  hasClearedPasswordGate,
  shouldShowWelcomeAfterGate,
} from "@/components/force-password-change-gate";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { useIdentity } from "@/lib/use-identity";

const wasStaffKey = (userId: string) => `aetheria:was-staff:${userId}`;

function markWasStaff(userId: string) {
  try {
    sessionStorage.setItem(wasStaffKey(userId), "1");
  } catch {
    /* private mode / blocked storage */
  }
}

function consumeWasStaff(userId: string) {
  try {
    const key = wasStaffKey(userId);
    if (sessionStorage.getItem(key) !== "1") return false;
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
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
  const { data: identity, error, isError, isFetching, refetch, isLoading } = useIdentity();
  const [signingOutRevoked, setSigningOutRevoked] = useState(false);

  // Revoked staff must not fall through to the patient shell — kick them out
  // as soon as identity reflects the lost staff role.
  useEffect(() => {
    if (!identity?.userId || signingOutRevoked) return;
    if (identity.isStaff) {
      markWasStaff(identity.userId);
      return;
    }
    if (!consumeWasStaff(identity.userId)) return;
    setSigningOutRevoked(true);
    void (async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        window.location.replace("/auth");
      }
    })();
  }, [identity, signingOutRevoked]);

  // Banned / revoked accounts: getMe fails — sign out instead of showing the error card forever.
  useEffect(() => {
    if (!isError || signingOutRevoked) return;
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("clinic access has been removed")) return;
    setSigningOutRevoked(true);
    void (async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        window.location.replace("/auth");
      }
    })();
  }, [isError, error, signingOutRevoked]);

  if (signingOutRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-deep border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-card max-w-md p-8 text-center">
          <h1 className="page-title">
            We could not load your account
          </h1>
          <p className="page-subtitle">
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

  if (isLoading || !identity || signingOutRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-deep border-t-transparent" />
      </div>
    );
  }

  // Synchronous check so we never paint the patient shell for a just-revoked member.
  let lostStaffAccess = false;
  try {
    lostStaffAccess =
      !identity.isStaff && sessionStorage.getItem(wasStaffKey(identity.userId)) === "1";
  } catch {
    lostStaffAccess = false;
  }
  if (lostStaffAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-deep border-t-transparent" />
      </div>
    );
  }

  const needsPassword =
    Boolean(identity.mustChangePassword) && !hasClearedPasswordGate(identity.userId);
  // Welcome only after the invite password gate — not after later password resets.
  const showWelcome =
    Boolean(identity.isStaff) &&
    !needsPassword &&
    shouldShowWelcomeAfterGate(identity.userId);

  return (
    <>
      {needsPassword && (
        <ForcePasswordChangeGate
          userId={identity.userId}
          welcomePending={Boolean(identity.welcomePending)}
        />
      )}
      <StaffWelcomeDialog
        open={showWelcome}
        userId={identity.userId}
        name={identity.profile?.full_name}
      />
      <Outlet />
    </>
  );
}
