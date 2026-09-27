import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SecuritySettings } from "@/components/security-settings";
import { StaffDocuments } from "@/components/staff-files";

export type ProfileTab = "security" | "documents";

/**
 * The Security and Documents panes of My profile. The tab pill lives on the
 * page header (Profile / Security / Documents); this renders the chosen pane.
 */
export function ProfileAccountTabs({
  userId,
  identity,
  tab,
}: {
  userId: string;
  identity: { userId?: string; mfaRequired?: boolean; email?: string };
  tab: ProfileTab;
}) {
  const [onFile, setOnFile] = useState(0);

  return (
    <section>
      {tab === "documents" ? (
        <div className="mb-3 flex items-center gap-2">
          <h2 className="section-title">On file</h2>
          <Badge variant="outline" className="rounded-xl text-2xs uppercase">
            {onFile} on file
          </Badge>
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        {tab === "security" ? (
          <SecuritySettings identity={identity} embedded />
        ) : (
          <div className="px-5 py-5 sm:px-6">
            <StaffDocuments userId={userId} embedded onCount={setOnFile} />
          </div>
        )}
      </Card>
    </section>
  );
}
