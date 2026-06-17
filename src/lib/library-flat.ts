import { arrangementKey } from "@/lib/arrangement-key";
import type { Folder, StoredSong } from "@/lib/types";

/** Todas as músicas da biblioteca (pastas + recentes), uma entrada por arranjo. */
export function flattenLibrarySongs(
  folders: Folder[],
  recentes: StoredSong[],
): StoredSong[] {
  const byKey = new Map<string, StoredSong>();
  for (const f of folders) {
    for (const s of f.songs) {
      byKey.set(arrangementKey(s), s);
    }
  }
  for (const s of recentes) {
    byKey.set(arrangementKey(s), s);
  }
  return [...byKey.values()];
}
