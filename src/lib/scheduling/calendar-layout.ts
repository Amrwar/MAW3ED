/**
 * Calendar geometry: pure date arithmetic and overlap layout.
 *
 * Split out of calendar.ts because that module imports `db` to load
 * bookings, and the calendar grid is a client component. Importing
 * these two functions across that line pulled PrismaClient — and the
 * generated metadata for every model and column in the database —
 * into the dashboard bundle.
 *
 * Nothing here touches the database or the network. Given a range it
 * returns dates; given start and end minutes it returns columns.
 */

import { dateToUTC } from "@/lib/bookings/instants";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Every date in an inclusive range. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = dateToUTC(to).getTime();
  for (let t = dateToUTC(from).getTime(); t <= end; t += 86_400_000) {
    out.push(iso(new Date(t)));
  }
  return out;
}

/* ─── Layout ─────────────────────────────────────────────── */

export interface LaidOutEntry<T> {
  entry: T;
  /** 0-based column among the overlapping group. */
  column: number;
  /** How many columns that group needs. */
  columns: number;
}

/**
 * Places overlapping appointments side by side.
 *
 * Two bookings at the same time on a staff-less business are a genuine
 * double booking and the calendar should show both, not hide one behind
 * the other. The same layout handles a business with three chairs
 * running three appointments at once.
 */
export function layoutDay<T extends { startMin: number; endMin: number }>(
  entries: T[],
): LaidOutEntry<T>[] {
  const sorted = [...entries].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: LaidOutEntry<T>[] = [];

  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    // Greedy column assignment: the first column whose last booking has
    // finished takes the next one.
    const columnEnds: number[] = [];
    const placed: { entry: T; column: number }[] = [];

    for (const e of cluster) {
      let col = columnEnds.findIndex((end) => end <= e.startMin);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(e.endMin);
      } else {
        columnEnds[col] = e.endMin;
      }
      placed.push({ entry: e, column: col });
    }

    for (const p of placed) out.push({ ...p, columns: columnEnds.length });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const e of sorted) {
    if (cluster.length > 0 && e.startMin >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.endMin);
  }
  flush();

  return out;
}
