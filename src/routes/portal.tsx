import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HeartPulse, CalendarCheck, FileSignature, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/portal")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Patient portal sign in — Aetheria" },
      {
        name: "description",
        content:
          "Sign in to your Aetheria patient portal to view treatments, before & after photos, sign consent forms and message your clinic.",
      },
      { property: "og:title", content: "Patient portal sign in — Aetheria" },
      {
        property: "og:description",
        content: "View your treatments, sign consent forms and message your clinic securely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalLogin,
});

const highlights = [
  { icon: CalendarCheck, text: "Your treatment history and what's due next" },
  { icon: FileSignature, text: "Consent forms and treatment plans to review and sign" },
  { icon: MessageCircle, text: "Message your practitioner directly" },
];

function PortalLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Signed-in users land in the view their role allows.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign you in");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-edge bg-gradient-to-br from-lane-4/45 via-glass-2 to-70% to-lane-7/40 p-12 shadow-inset-hi lg:flex">
        <div className="flex items-center gap-2 text-foreground">
          <HeartPulse className="h-5 w-5 text-accent-ink" />
          <span className="text-[17px] font-semibold tracking-[-0.016em]">Aetheria</span>
          <span className="ml-2 rounded-full border border-edge px-2 py-0.5 text-2xs tracking-[0.02em] text-muted-foreground">
            Patient portal
          </span>
        </div>
        <div className="max-w-md space-y-6">
          <h1 className="text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
            Your care, your record, in one private place.
          </h1>
          <ul className="space-y-3">
            {highlights.map((h) => (
              <li key={h.text} className="flex items-start gap-3 text-sm text-muted-foreground">
                <h.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
                {h.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Held to UK GDPR and JCCP expectations. Only you and your clinic can see your record.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="glass-card w-full max-w-sm p-8">
          <h2 className="text-[19px] font-semibold tracking-[-0.016em] text-foreground">Patient sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the email address your clinic holds for you.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="portal-email">Email</Label>
              <Input
                id="portal-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-password">Password</Label>
              <Input
                id="portal-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to my record"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs tracking-[0.02em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </Button>

          <p className="mt-8 text-sm text-muted-foreground">
            No account yet? Your clinic creates it when you register as a patient — contact them and
            they'll send your invitation.
          </p>
          <Link to="/auth" className="mt-4 block text-sm text-accent-ink hover:underline">
            Clinic staff sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
