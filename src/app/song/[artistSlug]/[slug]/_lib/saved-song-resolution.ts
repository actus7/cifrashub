import type { Folder, Section, StoredSong } from "@/lib/types";
import { arrangementKey } from "@/lib/arrangement-key";
import { songIdentityKey } from "@/lib/song-identity-key";

export function findSavedSong(
  song: StoredSong,
  folders: Folder[],
  recentes: StoredSong[],
  folderId: string | null,
  arrangementId: string | null,
) {
  return savedSongCandidates(folders, recentes, folderId)
    .find((saved) => savedSongMatches(saved, song, arrangementId));
}

export function savedSongCandidates(
  folders: Folder[],
  recentes: StoredSong[],
  folderId: string | null,
) {
  return [...preferredFolderSongs(folders, folderId), ...otherFolderSongs(folders, folderId), ...recentes];
}

export function preferredFolderSongs(folders: Folder[], folderId: string | null) {
  return folderId ? folders.find((folder) => folder.id === folderId)?.songs ?? [] : [];
}

export function otherFolderSongs(folders: Folder[], folderId: string | null) {
  return folders
    .filter((folder) => folder.id !== folderId)
    .flatMap((folder) => folder.songs);
}

export function savedSongMatches(saved: StoredSong, song: StoredSong, arrangementId: string | null) {
  if (arrangementId) return arrangementKey(saved) === arrangementId;
  return songIdentityKey(saved) === songIdentityKey(song);
}

export function reusableSavedContent(saved: StoredSong | undefined, arrangementId: string | null): Section[] | null {
  if (!saved || !arrangementId) return null;
  if (arrangementKey(saved) !== arrangementId) return null;
  return saved.songData;
}
