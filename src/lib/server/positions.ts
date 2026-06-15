/**
 * Next append position for an ordered collection: one past the current maximum,
 * or 0 when empty. Shared by folders, setlists, folder-songs, setlist-items and
 * the sync route so ordering semantics stay consistent across all of them.
 */
export function nextPosition(rows: readonly { position: number }[]): number {
  return rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.position)) + 1;
}
