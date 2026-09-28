import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ExternalLink } from "lucide-react";
import {
  saveMyInstantProfile,
  saveMyProfile,
  submitProfileChange,
  updateStaffMember,
} from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { daysUntil, invalidateProfileQueries } from "./profile-helpers";
import type { ProfileMode, ProfileSubject, ProfileViewer } from "./profile-types";

/** Where to check a registration, per body. */
const REGISTER_LINKS: Record<string, { label: string; href: string }> = {
  GMC: {
    label: "Check GMC register",
    href: "https://www.gmc-uk.org/registration-and-licensing/the-medical-register",
  },
  NMC: {
    label: "Check NMC register",
    href: "https://www.nmc.org.uk/registration/search-the-register/",
  },
  GDC: { label: "Check GDC register", href: "https://olr.gdc-uk.org/searchregister" },
  GPhC: { label: "Check GPhC register", href: "https://www.pharmacyregulation.org/registers" },
  HCPC: { label: "Check HCPC register", href: "https://www.hcpc-uk.org/check-the-register/" },
};

function longDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A 60 px ring showing days to renewal; over 365 days the ring is full. */
function DaysRing({ days, tone }: { days: number; tone: "warning" | "success" | "destructive" }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const fraction = days <= 0 ? 0 : Math.min(1, days / 365);
  const stroke =
    tone === "success"
      ? "var(--success)"
      : tone === "warning"
        ? "var(--warning-ink)"
        : "var(--destructive)";
  const track =
    tone === "success"
      ? "var(--success-bg)"
      : tone === "warning"
        ? "var(--warning-bg)"
        : "var(--destructive-bg)";
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden className="shrink-0">
      <circle cx="30" cy="30" r={r} fill="none" stroke={track} strokeWidth="6" />
      <circle
        cx="30"
        cy="30"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${circ * fraction} ${circ}`}
        transform="rotate(-90 30 30)"
      />
      <text
        x="30"
        y="35"
        textAnchor="middle"
        fontWeight="700"
        fontSize="15"
        fill="currentColor"
        className={
          tone === "success"
            ? "text-success-ink"
            : tone === "warning"
              ? "text-warning-ink"
              : "text-destructive-ink"
        }
      >
        {days < 0 ? "!" : days > 999 ? "∞" : days}
      </text>
    </svg>
  );
}

function CheckRing() {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden className="shrink-0">
      <circle
        cx="30"
        cy="30"
        r="24"
        fill="none"
        stroke="var(--success)"
        strokeWidth="6"
        opacity="0.6"
      />
      <path
        d="M22 30.5l5.5 5.5L38.5 25"
        fill="none"
        stroke="var(--success-ink)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Registration renewal and indemnity insurance, side by side. */
export function RegistrationInsuranceCard({
  mode,
  subject,
  viewer,
  todayKey,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  viewer: ProfileViewer;
  todayKey: string;
}) {
  const queryClient = useQueryClient();
  const direct = mode === "manage" || (mode === "self" && viewer.canSelfApply);
  const hasBody = subject.registrationBody && subject.registrationBody !== "None";
  const regDays = subject.registrationExpiry
    ? daysUntil(subject.registrationExpiry, todayKey)
    : null;
  const insDays = subject.insuranceExpiry ? daysUntil(subject.insuranceExpiry, todayKey) : null;
  const regTone: "warning" | "success" | "destructive" =
    regDays === null
      ? "warning"
      : regDays < 0
        ? "destructive"
        : regDays <= 90
          ? "warning"
          : "success";
  const insTone: "warning" | "success" | "destructive" =
    insDays === null
      ? "warning"
      : insDays < 0
        ? "destructive"
        : insDays <= 60
          ? "warning"
          : "success";

  const [regMode, setRegMode] = useState<"view" | "edit" | "sent">("view");
  const [renewInput, setRenewInput] = useState(subject.registrationExpiry);
  const [insMode, setInsMode] = useState<"view" | "edit">("view");
  const [insurer, setInsurer] = useState(subject.insuranceProvider);
  const [insExpiry, setInsExpiry] = useState(subject.insuranceExpiry);

  useEffect(() => {
    setRenewInput(subject.registrationExpiry);
    setInsurer(subject.insuranceProvider);
    setInsExpiry(subject.insuranceExpiry);
  }, [subject.registrationExpiry, subject.insuranceProvider, subject.insuranceExpiry]);

  const saveMine = useServerFn(saveMyProfile);
  const saveTheirs = useServerFn(updateStaffMember);
  const saveInstant = useServerFn(saveMyInstantProfile);
  const submitChange = useServerFn(submitProfileChange);

  const identityPatch = {
    fullName: subject.fullName,
    jobTitle: subject.jobTitle,
    registrationBody: subject.registrationBody,
    registrationNumber: subject.registrationNumber,
    registrationExpiry: subject.registrationExpiry,
    insuranceProvider: subject.insuranceProvider,
    insuranceExpiry: subject.insuranceExpiry,
    qualifications: subject.qualifications,
    workingArrangement: subject.workingArrangement,
  };

  const saveRenewal = useMutation({
    mutationFn: async () => {
      if (!renewInput) throw new Error("Choose the new renewal date.");
      if (mode === "manage") {
        return saveTheirs({
          data: {
            userId: subject.userId,
            role: (subject.role || "practitioner") as
              "owner" | "manager" | "practitioner" | "front_desk",
            ...identityPatch,
            registrationExpiry: renewInput,
          },
        });
      }
      if (viewer.canSelfApply) {
        return saveMine({
          data: { ...identityPatch, registrationExpiry: renewInput, workEmail: subject.email },
        });
      }
      return submitChange({
        data: {
          fullName: subject.fullName,
          jobTitle: subject.jobTitle,
          registrationBody: subject.registrationBody,
          registrationNumber: subject.registrationNumber,
          registrationExpiry: renewInput,
          note: "Registration renewed",
        },
      });
    },
    onSuccess: () => {
      setRegMode(direct ? "view" : "sent");
      if (direct) toast.success("Renewal date saved");
      invalidateProfileQueries(queryClient, subject.userId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePolicy = useMutation({
    mutationFn: async () => {
      if (mode === "manage") {
        return saveTheirs({
          data: {
            userId: subject.userId,
            role: (subject.role || "practitioner") as
              "owner" | "manager" | "practitioner" | "front_desk",
            ...identityPatch,
            insuranceProvider: insurer,
            insuranceExpiry: insExpiry,
          },
        });
      }
      return saveInstant({
        data: {
          insuranceProvider: insurer,
          insuranceExpiry: insExpiry,
          qualifications: subject.qualifications,
        },
      });
    },
    onSuccess: () => {
      setInsMode("view");
      toast.success("Insurance updated");
      invalidateProfileQueries(queryClient, subject.userId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const link = hasBody ? REGISTER_LINKS[subject.registrationBody] : undefined;
  const toneBg: Record<"warning" | "success" | "destructive", string> = {
    warning: "bg-warning-bg/70",
    success: "bg-success-bg/70",
    destructive: "bg-destructive-bg/70",
  };
  const toneInk: Record<"warning" | "success" | "destructive", string> = {
    warning: "text-warning-ink",
    success: "text-success-ink",
    destructive: "text-destructive-ink",
  };

  return (
    <Card className="flex flex-col gap-4 p-6" data-qc="registration-insurance">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title">Registration &amp; insurance</h2>
        <span className="text-xs text-muted-foreground">Owner reminded 60 days before expiry</span>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* Registration */}
        <div
          className={cn("flex flex-col gap-3 rounded-[20px] p-4", toneBg[regTone])}
          data-qc="registration-block"
        >
          <div className="flex items-center gap-3.5">
            {regDays === null ? <CheckRing /> : <DaysRing days={regDays} tone={regTone} />}
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground">
                {hasBody ? `${subject.registrationBody} registration` : "No statutory registration"}
              </p>
              {hasBody && subject.registrationNumber ? (
                <p className="font-mono text-xs text-muted-foreground">
                  PIN {subject.registrationNumber}
                </p>
              ) : null}
              {hasBody && subject.registrationExpiry ? (
                <p
                  className={cn("text-xs font-semibold", toneInk[regTone])}
                  data-qc="registration-renew-by"
                >
                  {regDays !== null && regDays < 0 ? "Lapsed on" : "Renew by"}{" "}
                  {longDate(subject.registrationExpiry)}
                </p>
              ) : hasBody ? (
                <p className="text-xs text-muted-foreground">No renewal date on file</p>
              ) : (
                <p className="text-xs text-muted-foreground">Nothing to renew</p>
              )}
            </div>
          </div>
          {hasBody && regMode === "view" ? (
            <div className="flex flex-wrap items-center gap-3">
              {!subject.revoked ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  onClick={() => {
                    setRenewInput(subject.registrationExpiry);
                    setRegMode("edit");
                  }}
                  data-qc="registration-renewed"
                >
                  I’ve renewed
                </Button>
              ) : null}
              {link ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink underline-offset-4 hover:underline"
                >
                  {link.label} <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
            </div>
          ) : null}
          {hasBody && regMode === "edit" ? (
            <div className="flex flex-col gap-2" data-qc="registration-renew-form">
              <Label htmlFor="ri-renew" className="text-xs">
                New renewal date
              </Label>
              <Input
                id="ri-renew"
                type="date"
                value={renewInput}
                onChange={(e) => setRenewInput(e.target.value)}
                className="bg-card"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  onClick={() => setRegMode("view")}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={saveRenewal.isPending || !renewInput}
                  onClick={() => saveRenewal.mutate()}
                  data-qc="registration-renew-save"
                >
                  {saveRenewal.isPending ? "Saving…" : direct ? "Save date" : "Send for approval"}
                </Button>
              </div>
            </div>
          ) : null}
          {regMode === "sent" ? (
            <p
              role="status"
              className="flex items-center gap-1.5 text-xs font-semibold text-success-ink"
              data-qc="registration-renew-sent"
            >
              <Check className="h-3.5 w-3.5" /> New date sent to{" "}
              {viewer.requiresOwner ? "the clinic owner" : "your manager"} to confirm.
            </p>
          ) : null}
        </div>

        {/* Insurance */}
        <div
          className={cn("flex flex-col gap-3 rounded-[20px] p-4", toneBg[insTone])}
          data-qc="insurance-block"
        >
          <div className="flex items-center gap-3.5">
            {insTone === "success" ? (
              <CheckRing />
            ) : (
              <DaysRing days={insDays ?? 0} tone={insTone} />
            )}
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground">
                {subject.insuranceProvider || "Indemnity insurance"}
              </p>
              <p className="text-xs text-muted-foreground">
                {subject.presentCategories.includes("indemnity_insurance")
                  ? "Certificate on file"
                  : "No certificate on file"}
              </p>
              {subject.insuranceExpiry ? (
                <p
                  className={cn("text-xs font-semibold", toneInk[insTone])}
                  data-qc="insurance-valid-until"
                >
                  {insDays !== null && insDays < 0 ? "Lapsed on" : "Valid until"}{" "}
                  {longDate(subject.insuranceExpiry)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No expiry on file</p>
              )}
            </div>
          </div>
          {insMode === "view" ? (
            <div className="flex flex-wrap items-center gap-3">
              {!subject.revoked ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  onClick={() => {
                    setInsurer(subject.insuranceProvider);
                    setInsExpiry(subject.insuranceExpiry);
                    setInsMode("edit");
                  }}
                  data-qc="insurance-update"
                >
                  Update policy
                </Button>
              ) : null}
              {insDays !== null && insDays >= 0 ? (
                <span className="text-xs text-muted-foreground">{insDays} days left</span>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-2" data-qc="insurance-form">
              <div className="field-stack">
                <Label htmlFor="ri-insurer" className="text-xs">
                  Insurer
                </Label>
                <Input
                  id="ri-insurer"
                  value={insurer}
                  onChange={(e) => setInsurer(e.target.value)}
                  placeholder="e.g. Hamilton Fraser"
                  className="bg-card"
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="ri-ins-expiry" className="text-xs">
                  Valid until
                </Label>
                <Input
                  id="ri-ins-expiry"
                  type="date"
                  value={insExpiry}
                  onChange={(e) => setInsExpiry(e.target.value)}
                  className="bg-card"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  onClick={() => setInsMode("view")}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={savePolicy.isPending}
                  onClick={() => savePolicy.mutate()}
                  data-qc="insurance-save"
                >
                  {savePolicy.isPending ? "Saving…" : "Save policy"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
