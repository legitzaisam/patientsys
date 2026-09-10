import { toast } from "sonner";
import { startOAuth, type OAuthProvider } from "@/lib/auth/oauth";
import type { AuthSurface } from "@/lib/auth/constants";
import { Button } from "@/components/ui/button";

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: "google", label: "Continue with Google" },
  { id: "azure", label: "Continue with Microsoft" },
];

export function OAuthButtons({ surface }: { surface: AuthSurface }) {
  async function start(provider: OAuthProvider) {
    try {
      await startOAuth(provider, surface);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start sign-in");
    }
  }

  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => (
        <Button key={p.id} type="button" variant="outline" className="w-full" onClick={() => void start(p.id)}>
          {p.label}
        </Button>
      ))}
    </div>
  );
}
