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

function uiPrefsFromStored(s: StoredSong): StoredSongUiPrefs | null {
  const u: StoredSongUiPrefs = {};
  if (s.simplified !== undefined) u.simplified = s.simplified;
  if (s.showTabs !== undefined) u.showTabs = s.showTabs;
  if (s.mirrored !== undefined) u.mirrored = s.mirrored;
  if (s.fontSizeOffset !== undefined) u.fontSizeOffset = s.fontSizeOffset;
  if (s.columns !== undefined) u.columns = s.columns;
  if (s.spacingOffset !== undefined) u.spacingOffset = s.spacingOffset;
  return Object.keys(u).length > 0 ? u : null;
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
