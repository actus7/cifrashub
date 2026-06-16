import type { StoredSong, StoredSongUiPrefs } from "@/lib/types";
import {
  resolveArrangementId,
  sourceArtistSlugForRow,
  sourceSlugForRow,
} from "@/lib/server/song-persist";
import { isValidYoutubeId } from "@/lib/youtube";

/** ID válido para embed ou `null` (não persiste string inválida no banco). */
export function youtubeIdForRow(s: Pick<StoredSong, "youtubeId">): string | null {
  const v = s.youtubeId?.trim();
  return isValidYoutubeId(v) ? v : null;
}

const UI_PREF_KEYS = [
  "simplified",
  "showTabs",
  "mirrored",
  "fontSizeOffset",
  "columns",
  "spacingOffset",
  "zenMode",
  "autoScroll",
  "scrollSpeed",
  "metronomeActive",
  "bpm",
] as const satisfies ReadonlyArray<keyof StoredSongUiPrefs>;

function uiPrefsFromStored(s: StoredSong): StoredSongUiPrefs | null {
  const entries = UI_PREF_KEYS
    .map(key => [key, s[key]] as const)
    .filter((entry): entry is readonly [keyof StoredSongUiPrefs, NonNullable<typeof entry[1]>] => entry[1] !== undefined);

  return entries.length > 0 ? Object.fromEntries(entries) as StoredSongUiPrefs : null;
}

export function toneCapoUiFromStored(s: StoredSong): {
  tone: number;
  capo: number;
  uiPrefs: StoredSongUiPrefs | null;
} {
  return {
    tone: s.tone ?? 0,
    capo: s.capo ?? 0,
    uiPrefs: uiPrefsFromStored(s),
  };
}

export function buildStoredSongRow(
  userId: string,
  folderId: string | null,
  song: StoredSong,
  position: number,
  isRecent: boolean,
) {
  const row = toneCapoUiFromStored(song);
  return {
    userId,
    folderId,
    songId: song.id,
    arrangementId: resolveArrangementId(song),
    sourceArtistSlug: sourceArtistSlugForRow(song),
    sourceSlug: sourceSlugForRow(song),
    title: song.title,
    artist: song.artist,
    artistSlug: song.artistSlug,
    slug: song.slug,
    youtubeId: youtubeIdForRow(song),
    songData: song.songData,
    tone: row.tone,
    capo: row.capo,
    uiPrefs: row.uiPrefs,
    isRecent,
    position,
  };
}
