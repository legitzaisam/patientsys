import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BrandLockup } from "@/components/brand-mark";
import {
  ConsentContraindications,
  contraindicationsComplete,
  type ContraindicationAnswer,
} from "@/components/consent-contraindications";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Public consent signing page, reached from the emailed magic link. No sign-in:
 * the access token is the credential. Shows only the document itself — no
 * patient identity, no clinical record.
 */

type PublicDocument = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  status: string;
  expires_at: string | null;
};

export const Route = createFileRoute("/d/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your form — Aetheria Clinic" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublicDocumentPage,
});

type LinkState =
  | { state: "loading" }
  | { state: "ok"; document: PublicDocument }
  | { state: "signed" }
  | { state: "not_found" };

function PublicDocumentPage() {
  const { token } = Route.useParams();
  const [justSigned, setJustSigned] = useState(false);
  const [answers, setAnswers] = useState<Record<string, ContraindicationAnswer | undefined>>({});

  const link = useQuery<LinkState>({
    queryKey: ["public-document", token],
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/documents/access/${encodeURIComponent(token)}`);
      if (res.status === 409) return { state: "signed" };
      if (!res.ok) return { state: "not_found" };
      const body = (await res.json()) as { document: PublicDocument };
      return { state: "ok", document: body.document };
    },
  });

  const sign = useMutation({
    mutationFn: async (input: { signedName: string; contraindications?: Record<string, ContraindicationAnswer> }) => {
      const res = await fetch(`/api/documents/access/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signed_name: input.signedName,
          ...(input.contraindications ? { contraindications: input.contraindications } : {}),
        }),
      });
      if (res.status === 409) throw new Error("signed");
      if (!res.ok) throw new Error("not_found");
      return true;
    },
    onSuccess: () => setJustSigned(true),
  });

  const data: LinkState = link.isPending
    ? { state: "loading" }
    : (link.data ?? { state: "not_found" });

  return (
    <div className="flex min-h-dvh flex-col items-center bg-background px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <BrandLockup />
        </div>

        {data.state === "loading" && (
          <Card className="p-6 text-sm text-muted-foreground">Loading your form…</Card>
        )}

        {data.state === "not_found" && (
          <Card className="p-6">
            <h1 className="text-lg font-semibold text-foreground">This link isn't available</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The link may have expired or been replaced. Please contact the clinic and we will send
              you a fresh one.
            </p>
          </Card>
        )}

        {(data.state === "signed" || (data.state === "ok" && justSigned)) && (
          <Card className="p-6">
            <h1 className="text-lg font-semibold text-foreground">
              {justSigned ? "Thank you — form signed" : "Already completed"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {justSigned
                ? "We have recorded your signature. You can close this page."
                : "This form has already been signed. Nothing more is needed."}
            </p>
          </Card>
        )}

        {data.state === "ok" && !justSigned && (
          <Card className="p-6">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              {data.document.kind.replace("_", " ")}
            </p>
            <h1 className="mt-1 text-lg font-semibold text-foreground">{data.document.title}</h1>
            {data.document.body && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {data.document.body}
              </p>
            )}

            <form
              className="mt-6 space-y-3 border-t border-edge pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                const name = String(new FormData(e.currentTarget).get("signed_name") ?? "");
                const isConsent = data.document.kind === "consent";
                if (isConsent && !contraindicationsComplete(answers)) return;
                const contraindications = isConsent
                  ? (Object.fromEntries(
                      Object.entries(answers).filter((entry): entry is [string, ContraindicationAnswer] => Boolean(entry[1])),
                    ) as Record<string, ContraindicationAnswer>)
                  : undefined;
                sign.mutate({ signedName: name, contraindications });
              }}
            >
              {data.document.kind === "consent" ? (
                <ConsentContraindications
                  value={answers}
                  onChange={(key, answer) => setAnswers((prev) => ({ ...prev, [key]: answer }))}
                />
              ) : null}
              <div className="field-stack">
                <Label htmlFor="signed_name">Type your full name to sign</Label>
                <Input
                  id="signed_name"
                  name="signed_name"
                  required
                  autoComplete="name"
                  className="rounded-xl"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                By signing you confirm you have read and understood this form.
              </p>
              <Button
                type="submit"
                disabled={sign.isPending || (data.document.kind === "consent" && !contraindicationsComplete(answers))}
              >
                {sign.isPending ? "Signing…" : "Sign form"}
              </Button>
              {sign.isError && (
                <p className="text-xs text-destructive">
                  {sign.error.message === "signed"
                    ? "This form has already been signed."
                    : "We could not record your signature. Please try again or contact the clinic."}
                </p>
              )}
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
