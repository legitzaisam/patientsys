export type PractitionerDayAlertRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  recipient_id: string;
  read_at: string | null;
  recipient_dismissed_at?: string | null;
};

export type PractitionerDayAlert = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  /** The viewer received this alert, so they can open it to acknowledge, reply or dismiss. */
  forMe: boolean;
  acknowledged: boolean;
};

/**
 * Urgent alerts a practitioner sent, newest first, for their day card. A team-wide alert is stored
 * once per recipient, so the copies fold into one entry, keeping the viewer's own copy when there
 * is one: that is the row they can act on. Alerts the viewer dismissed drop out.
 */
export function practitionerDayAlerts(
  rows: PractitionerDayAlertRow[],
  viewerId: string,
  limit = 3,
): PractitionerDayAlert[] {
  const groups = new Map<string, PractitionerDayAlertRow>();
  for (const row of rows) {
    const mine = row.recipient_id === viewerId;
    if (mine && row.recipient_dismissed_at) continue;
    const key = `${row.title}|${row.body ?? ""}|${row.created_at.slice(0, 16)}`;
    const held = groups.get(key);
    if (!held || (mine && held.recipient_id !== viewerId)) groups.set(key, row);
  }
  return [...groups.values()].slice(0, limit).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    created_at: row.created_at,
    forMe: row.recipient_id === viewerId,
    acknowledged: row.recipient_id === viewerId && Boolean(row.read_at),
  }));
}
