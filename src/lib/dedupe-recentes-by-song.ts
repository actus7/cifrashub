import type { StoredSong } from "@/lib/types";
import { songIdentityKey } from "@/lib/song-identity-key";

export function dedupeRecentesBySong<T extends Pick<StoredSong, "id" | "artistSlug" | "slug">>(
  songs: T[],
): T[] {
  if (!Array.isArray(songs)) return [];
  const seen = new Set<string>();
  return songs.filter((song) => {
    if (!song) return false;
    const key = songIdentityKey(song);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
