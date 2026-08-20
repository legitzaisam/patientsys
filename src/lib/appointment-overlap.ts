/** Shared practitioner double-booking / overlap helpers. */

export const PRACTITIONER_OVERLAP_MESSAGE =
  "This practitioner already has a booking that overlaps this time.";

export type OverlapInterval = {
  id: string;
  starts_at: string;
  ends_at: string;
  status?: string | null;
};

/** Cancelled appointments free the diary slot; everything else blocks. */
export function occupiesPractitionerSlot(status?: string | null) {
  return status !== "cancelled";
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && aEnd > bStart;
}

/** True if `candidate` overlaps any active appointment for the same practitioner. */
export function findPractitionerOverlap(args: {
  appointments: OverlapInterval[];
  startsAt: string | Date;
  endsAt: string | Date;
  excludeAppointmentId?: string | null;
}) {
  const start = new Date(args.startsAt).getTime();
  const end = new Date(args.endsAt).getTime();
  if (!(end > start)) return null;

  for (const row of args.appointments) {
    if (args.excludeAppointmentId && row.id === args.excludeAppointmentId) continue;
    if (!occupiesPractitionerSlot(row.status)) continue;
    const rowStart = new Date(row.starts_at).getTime();
    const rowEnd = new Date(row.ends_at).getTime();
    if (intervalsOverlap(start, end, rowStart, rowEnd)) return row;
  }
  return null;
}

export type OverlapLane = { lane: number; laneCount: number };

/**
 * Pack overlapping appointments into side-by-side lanes (calendar-style).
 * Non-overlapping items get laneCount 1.
 */
export function assignOverlapLanes<T extends { id: string; starts_at: string; ends_at: string }>(
  items: T[],
): Map<string, OverlapLane> {
  const result = new Map<string, OverlapLane>();
  if (items.length === 0) return result;

  const sorted = [...items].sort((a, b) => {
    const as = new Date(a.starts_at).getTime();
    const bs = new Date(b.starts_at).getTime();
    if (as !== bs) return as - bs;
    return new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime();
  });

  type Node = { id: string; start: number; end: number; lane: number };
  let cluster: Node[] = [];
  let clusterEnd = 0;

  const flush = () => {
    if (!cluster.length) return;
    const columns: Node[][] = [];
    for (const node of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]!;
        if (col.every((c) => c.end <= node.start)) {
          node.lane = i;
          col.push(node);
          placed = true;
          break;
        }
      }
      if (!placed) {
        node.lane = columns.length;
        columns.push([node]);
      }
    }
    const laneCount = Math.max(1, columns.length);
    for (const node of cluster) {
      result.set(node.id, { lane: node.lane, laneCount });
    }
    cluster = [];
    clusterEnd = 0;
  };

  for (const item of sorted) {
    const start = new Date(item.starts_at).getTime();
    const end = new Date(item.ends_at).getTime();
    if (cluster.length && start >= clusterEnd) flush();
    cluster.push({ id: item.id, start, end, lane: 0 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return result;
}
