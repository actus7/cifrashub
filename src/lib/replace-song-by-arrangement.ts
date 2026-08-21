import { arrangementKey } from "./arrangement-key";
import type { StoredSong } from "./types";

/**
 * Replace a song in a list by arrangement key, or prepend if not found.
 * Used by both edit-result persistence and version-reset persistence.
 */
export function replaceSongByArrangement(songs: StoredSong[], song: StoredSong): StoredSong[] {
  const key = arrangementKey(song);
  let replaced = false;
  const next = songs.map((s) => {
    if (arrangementKey(s) !== key) return s;
    replaced = true;
    return song;
  });

  return replaced ? next : [song, ...next];
}
