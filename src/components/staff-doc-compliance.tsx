import { BellRing, CheckCircle2, CircleAlert } from "lucide-react";
import { StaffAlertDialog } from "@/components/staff-alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ESSENTIAL_DOC_CATEGORIES,
  missingEssentialDocs,
  remindUploadCopy,
} from "@/lib/staff-doc-compliance";

/** Reception / team viewers: which essential docs are missing — no file contents. */
export function StaffDocCompliance({
  userId,
  fullName,
  presentCategories,
}: {
  userId: string;
  fullName: string;
  presentCategories: string[];
}) {
  const missing = missingEssentialDocs(presentCategories);
  const presentCount = ESSENTIAL_DOC_CATEGORIES.length - missing.length;
  const copy = remindUploadCopy(missing.map((m) => m.label));

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">
            Essential documents
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Status only — for UK employment, GDPR and JCCP practice. File contents stay private to
            the team member and clinic owners.
          </p>
        </div>
        <Badge variant="outline" className="rounded-xl text-2xs uppercase">
          {presentCount}/{ESSENTIAL_DOC_CATEGORIES.length} on file
        </Badge>
      </div>

      <ul className="mt-5 space-y-2">
        {ESSENTIAL_DOC_CATEGORIES.map((c) => {
          const onFile = presentCategories.includes(c.value);
          return (
            <li
              key={c.value}
              className="flex items-start gap-3 rounded-2xl border border-edge px-3.5 py-3"
            >
              {onFile ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              ) : (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{c.label}</p>
                <p className="mt-0.5 text-2xs text-muted-foreground">{c.reason}</p>
              </div>
              <span
                className={`shrink-0 text-2xs font-semibold ${
                  onFile ? "text-success-ink" : "text-warning-ink"
                }`}
              >
                {onFile ? "On file" : "Missing"}
              </span>
            </li>
          );
        })}
      </ul>

      {missing.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-glass-2 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {missing.length} essential {missing.length === 1 ? "document is" : "documents are"}{" "}
            still needed.
          </p>
          <StaffAlertDialog
            recipientId={userId}
            recipientName={fullName}
            defaultBody={[copy.title, copy.body].filter(Boolean).join("\n\n")}
          >
            <Button type="button" size="sm">
              <BellRing className="mr-1.5 h-3.5 w-3.5" />
              Remind to upload
            </Button>
          </StaffAlertDialog>
        </div>
      )}
    </Card>
  );
}
