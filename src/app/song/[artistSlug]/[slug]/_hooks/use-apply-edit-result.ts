import { useEffect, useRef, type MutableRefObject } from "react";
import { useSession } from "@/hooks/use-session";
import { arrangementKey } from "@/lib/arrangement-key";
import { readEditResult, type EditOrigin } from "@/lib/cifras-edit-bridge";
import { cloudAddSongToFolder, cloudSaveRecentes, saveFolders, saveRecentes } from "@/lib/storage";
import type { Section, StoredSong } from "@/lib/types";
import { useLibraryStore } from "@/store/use-library-store";

export function useApplyEditResult(
  artistSlug: string | undefined,
  slug: string | undefined,
  folderId: string | null,
  arrangementId: string | null,
  currentSong: StoredSong | null,
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
  setSongData: (data: Section[]) => void,
) {
  const { status } = useSession();
  const appliedRef = useRef(false);

  useEffect(() => applyEditResult({
    appliedRef,
    arrangementId,
    artistSlug,
    currentSong,
    folderId,
    setCurrentSong,
    setSongData,
    slug,
    status,
  }), [artistSlug, slug, folderId, arrangementId, currentSong, setCurrentSong, setSongData, status]);
}

type ApplyEditResultArgs = {
  appliedRef: MutableRefObject<boolean>;
  artistSlug: string | undefined;
  slug: string | undefined;
  folderId: string | null;
  arrangementId: string | null;
  currentSong: StoredSong | null;
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void;
  setSongData: (data: Section[]) => void;
  status: ReturnType<typeof useSession>["status"];
};

function applyEditResult(args: ApplyEditResultArgs) {
  if (!canApplyEditResult(args)) return;
  const result = readEditResult();
  if (!result) return;
  args.appliedRef.current = true;
  if (!originMatchesRoute(result.origin, args.artistSlug!, args.slug!, args.folderId, args.arrangementId)) return;
  persistAppliedEdit(args, result.songData);
}

function canApplyEditResult({ appliedRef, currentSong, artistSlug, slug, status }: ApplyEditResultArgs) {
  return !appliedRef.current && status !== "loading" && Boolean(currentSong && artistSlug && slug);
}

function originMatchesRoute(
  origin: EditOrigin,
  artistSlug: string,
  slug: string,
  folderId: string | null,
  arrangementId: string | null,
) {
  return (
    origin.artistSlug === artistSlug &&
    origin.slug === slug &&
    origin.folderId === folderId &&
    origin.arrangementId === arrangementId
  );
}

function persistAppliedEdit(args: ApplyEditResultArgs, songData: Section[]) {
  args.setSongData(songData);
  const editedSong: StoredSong = { ...args.currentSong!, songData };
  args.setCurrentSong((prev) => (prev ? { ...prev, songData } : prev));
  void persistEditedContent(args, editedSong).catch((error) => {
    console.error("Failed to persist edited song content", error);
  });
}

function persistEditedContent(args: ApplyEditResultArgs, editedSong: StoredSong) {
  return args.status === "authenticated"
    ? persistEditedContentCloud(args.folderId, editedSong)
    : Promise.resolve(persistEditedContentLocal(args.folderId, editedSong));
}

async function persistEditedContentCloud(folderId: string | null, song: StoredSong) {
  if (folderId) {
    const { folders } = await cloudAddSongToFolder(folderId, song);
    useLibraryStore.getState().setFolders(folders);
    return;
  }
  const { recentes, setRecentes } = useLibraryStore.getState();
  const nextRecentes = replaceSongByArrangement(recentes, song).slice(0, 15);
  const { recentes: synced } = await cloudSaveRecentes(nextRecentes);
  setRecentes(synced);
}

function persistEditedContentLocal(folderId: string | null, song: StoredSong) {
  if (folderId) {
    const { folders, setFolders } = useLibraryStore.getState();
    const nextFolders = folders.map((folder) =>
      folder.id !== folderId
        ? folder
        : { ...folder, songs: replaceSongByArrangement(folder.songs, song) },
    );
    saveFolders(nextFolders);
    setFolders(nextFolders);
    return;
  }
  const { recentes, setRecentes } = useLibraryStore.getState();
  const nextRecentes = replaceSongByArrangement(recentes, song).slice(0, 15);
  saveRecentes(nextRecentes);
  setRecentes(nextRecentes);
}

function replaceSongByArrangement(songs: StoredSong[], song: StoredSong) {
  const key = arrangementKey(song);
  let replaced = false;
  const next = songs.map((s) => {
    if (arrangementKey(s) !== key) return s;
    replaced = true;
    return song;
  });

  return replaced ? next : [song, ...next];
}
