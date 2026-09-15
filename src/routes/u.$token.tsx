import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { BrandLockup } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Public unsubscribe page from email footers. The token names one patient and
 * nothing else is shown — no name, no record. A confirming click is required
 * so link prefetchers cannot opt anyone out.
 */
export const Route = createFileRoute("/u/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Email preferences — Aetheria Clinic" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = Route.useParams();

  const unsubscribe = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/comms/unsubscribe/${encodeURIComponent(token)}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("not_found");
      return true;
    },
  });

  return (
    <div className="flex min-h-dvh flex-col items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLockup />
        </div>

        {unsubscribe.isSuccess ? (
          <Card className="p-6">
            <h1 className="text-lg font-semibold text-foreground">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We will no longer send you marketing messages or appointment reminders. Messages that
              are part of your care — booking confirmations, consent forms and receipts — will still
              reach you. You can turn reminders back on any time from your patient portal or by
              asking at the clinic.
            </p>
          </Card>
        ) : unsubscribe.isError ? (
          <Card className="p-6">
            <h1 className="text-lg font-semibold text-foreground">This link isn't available</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The link may have expired or been replaced. Please contact the clinic and we will
              update your preferences for you.
            </p>
          </Card>
        ) : (
          <Card className="p-6">
            <h1 className="text-lg font-semibold text-foreground">Stop clinic messages?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This stops marketing messages and appointment reminders by email and text. Messages
              that are part of your care still arrive.
            </p>
            <Button
              className="mt-4"
              disabled={unsubscribe.isPending}
              onClick={() => unsubscribe.mutate()}
            >
              {unsubscribe.isPending ? "Updating…" : "Unsubscribe"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
