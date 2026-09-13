import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { listMySessions, revokeOtherSessions } from "@/lib/clinic.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type IdentityLike = {
  userId?: string;
  mfaRequired?: boolean;
  email?: string;
};

export function SecuritySettings({ identity }: { identity: IdentityLike }) {
  const queryClient = useQueryClient();
  const fetchSessions = useServerFn(listMySessions);
  const { data: sessions } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: () => fetchSessions(),
    enabled: !DEMO_MODE,
  });

  const signOutOthers = useMutation({
    mutationFn: useServerFn(revokeOtherSessions),
    onSuccess: async () => {
      toast.success("Other devices have been signed out");
      void queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-ink-3" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Security</h2>
          <p className="text-xs text-muted-foreground">
            Email sign-in codes, and the devices currently signed in as you.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Email codes</p>
        <p className="text-sm text-muted-foreground">
          {DEMO_MODE
            ? "Two-factor authentication is not used in demo mode."
            : identity.mfaRequired
              ? `Owners and managers confirm each sign-in with a 6-digit code sent to ${identity.email || "their email"}.`
              : "Owners and managers confirm sign-in with a 6-digit code emailed to them."}
        </p>
      </div>

      <div className="space-y-3 border-t border-edge pt-4">
        <p className="text-sm font-medium text-foreground">Signed-in devices</p>
        {(sessions?.sessions ?? [{ id: "current", current: true, createdAt: new Date().toISOString() }]).map(
          (row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-glass-line px-3 py-2.5"
            >
              <div>
                <p className="text-sm text-foreground">{row.current ? "This device" : "Another device"}</p>
                <p className="text-xs text-muted-foreground">
                  {row.createdAt
                    ? `Since ${new Date(row.createdAt).toLocaleString("en-GB")}`
                    : "Current session"}
                </p>
              </div>
            </div>
          ),
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={DEMO_MODE || signOutOthers.isPending}
            onClick={() => signOutOthers.mutate({} as never)}
          >
            {signOutOthers.isPending ? "Signing out…" : "Sign out other devices"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
