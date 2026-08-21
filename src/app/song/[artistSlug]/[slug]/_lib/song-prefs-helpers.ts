import type { Folder, StoredSong, StoredSongUiPrefs } from "@/lib/types";
import { songIdentityKey } from "@/lib/song-identity-key";
import { PLAYER_PREF_DEFAULTS, PLAYER_PREF_KEYS } from "@/lib/player-pref-defaults";

export type PersistedPlayerPrefs = Pick<StoredSong, keyof typeof PLAYER_PREF_DEFAULTS>;

/** Source of player pref values (tone, capo, simplified, etc.). */
export type PlayerPrefsSource = Record<keyof typeof PLAYER_PREF_DEFAULTS, number | boolean>;

export function playerPrefs(source: PlayerPrefsSource): PersistedPlayerPrefs {
  return Object.fromEntries(PLAYER_PREF_KEYS.map((key) => [key, source[key]])) as PersistedPlayerPrefs;
}

export function withPlayerPrefs(song: StoredSong, prefs: PersistedPlayerPrefs): StoredSong {
  return { ...song, ...prefs };
}

export function arePrefsEqual(song: StoredSong, prefs: PersistedPlayerPrefs): boolean {
  return PLAYER_PREF_KEYS.every((key) => (song[key] ?? PLAYER_PREF_DEFAULTS[key]) === prefs[key]);
}

export function uiPrefs(source: PlayerPrefsSource): StoredSongUiPrefs {
  const prefs = playerPrefs(source);
  return Object.fromEntries(
    PLAYER_PREF_KEYS.filter((key) => key !== "tone" && key !== "capo").map((key) => [key, prefs[key]]),
  ) as StoredSongUiPrefs;
}

/**
 * Apply prefs to a recentes list: replace the matching song (by identity)
 * with `nextSong`, or prepend if not found. Caps at 15 entries.
 */
export function applyPrefsToRecentes(
  recentes: StoredSong[],
  currentKey: string,
  nextSong: StoredSong,
): StoredSong[] {
  return [nextSong, ...recentes.filter((song) => songIdentityKey(song) !== currentKey)].slice(0, 15);
}

/**
 * Apply prefs to all folders: update every song whose identity matches
 * `currentKey`. Returns the original reference if no song matches (no-op).
 */
export function applyPrefsToFolders(
  folders: Folder[],
  currentKey: string,
  prefs: PersistedPlayerPrefs,
): Folder[] {
  const hasMatch = folders.some((folder) =>
    folder.songs.some((song) => songIdentityKey(song) === currentKey),
  );
  if (!hasMatch) return folders;
  return folders.map((folder) => ({
    ...folder,
    songs: folder.songs.map((song) =>
      songIdentityKey(song) === currentKey ? withPlayerPrefs(song, prefs) : song,
    ),
  }));
}
