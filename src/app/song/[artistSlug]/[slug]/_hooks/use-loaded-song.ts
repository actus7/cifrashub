import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLibraryActions } from "@/hooks/use-library-actions";
import type { Section, StoredSong } from "@/lib/types";
import { useLibraryStore } from "@/store/use-library-store";
import { usePlayerStore } from "@/store/use-player-store";
import { findSavedSong, reusableSavedContent } from "../_lib/saved-song-resolution";
import { isLoadSongError, loadSongResult } from "../_lib/load-song-result";

type LoadedSongRefsArgs = {
  addToRecentes: (song: StoredSong) => void;
  folders: ReturnType<typeof useLibraryStore.getState>["folders"];
  recentes: StoredSong[];
  folderId: string | null;
  arrangementId: string | null;
  ownerId: string | null;
};

function useLoadedSongRefs({ addToRecentes, arrangementId, folderId, folders, ownerId, recentes }: LoadedSongRefsArgs) {
  const addToRecentesRef = useRef(addToRecentes);
  const foldersRef = useRef(folders);
  const recentesRef = useRef(recentes);
  const folderIdRef = useRef(folderId);
  const arrangementIdRef = useRef(arrangementId);
  const ownerIdRef = useRef(ownerId);

  useEffect(() => {
    addToRecentesRef.current = addToRecentes;
    foldersRef.current = folders;
    recentesRef.current = recentes;
    folderIdRef.current = folderId;
    arrangementIdRef.current = arrangementId;
    ownerIdRef.current = ownerId;
  }, [addToRecentes, arrangementId, folderId, folders, ownerId, recentes]);

  return useMemo(() => ({
    addToRecentes: addToRecentesRef,
    arrangementId: arrangementIdRef,
    folderId: folderIdRef,
    folders: foldersRef,
    ownerId: ownerIdRef,
    recentes: recentesRef,
  }), []);
}

async function fetchSharedSong(ownerId: string, arrangementId: string): Promise<{ song: StoredSong; ownerName: string | null } | null> {
  try {
    const res = await fetch(`/api/shared/song?ownerId=${encodeURIComponent(ownerId)}&arrangementId=${encodeURIComponent(arrangementId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function useLoadedSong(artistSlug: string | undefined, slug: string | undefined) {
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folderId");
  const arrangementId = searchParams.get("arrangementId");
  const ownerId = searchParams.get("ownerId");
  const [currentSong, setCurrentSong] = useState<StoredSong | null>(null);
  const [songData, setSongData] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasSavedVersion, setHasSavedVersion] = useState(false);
  const [isSharedContext, setIsSharedContext] = useState(false);
  const [sharedOwnerName, setSharedOwnerName] = useState<string | null>(null);
  const initialCachedSongDataRef = useRef<Section[]>([]);
  const savedSongDataRef = useRef<Section[] | null>(null);
  const applySongPrefs = usePlayerStore((s) => s.applySongPrefs);
  const { addToRecentes } = useLibraryActions();
  const folders = useLibraryStore((s) => s.folders);
  const recentes = useLibraryStore((s) => s.recentes);
  const libraryLoaded = useLibraryStore((s) => s.libraryLoaded);

  const refs = useLoadedSongRefs({ addToRecentes, arrangementId, folderId, folders, ownerId, recentes });
  const lastRequestedRef = useRef("");

  const applyResult = useCallback(async (result: Awaited<ReturnType<typeof loadSongResult>>) => {
    if (isLoadSongError(result)) {
      setError(result.error);
      return;
    }

    const owner = refs.ownerId.current;
    const shared = owner ? await fetchSharedSong(owner, refs.arrangementId.current ?? "") : null;
    if (shared) {
      initialCachedSongDataRef.current = shared.song.songData;
      savedSongDataRef.current = shared.song.songData;
      setHasSavedVersion(true);
      setIsSharedContext(true);
      setSharedOwnerName(shared.ownerName);
      setCurrentSong(shared.song);
      setSongData(shared.song.songData);
      applySongPrefs(shared.song);
      return;
    }

    setIsSharedContext(false);
    setSharedOwnerName(null);
    const savedSong = findSavedSong(result.song, refs.folders.current, refs.recentes.current, refs.folderId.current, refs.arrangementId.current);
    const songData = reusableSavedContent(savedSong, refs.arrangementId.current) ?? result.song.songData;

    initialCachedSongDataRef.current = result.song.songData;
    savedSongDataRef.current = savedSong ? savedSong.songData : null;
    setHasSavedVersion(Boolean(savedSong));

    applyLoadedSong({ ...result.song, ...savedSong, songData }, setCurrentSong, setSongData, applySongPrefs, refs.addToRecentes.current);
  }, [applySongPrefs, refs]);

  const load = useCallback(async () => {
    const requestKey = songRequestKey(artistSlug, slug, libraryLoaded);
    if (!requestKey) return;
    lastRequestedRef.current = requestKey;
    setIsLoading(true);
    setError(null);

    const result = await loadSongResult(artistSlug!, slug!);
    if (lastRequestedRef.current !== requestKey) return;

    await applyResult(result);
    setIsLoading(false);
  }, [applyResult, artistSlug, libraryLoaded, slug]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [load]);

  return {
    currentSong, setCurrentSong, songData, setSongData,
    isLoading, error, load, folderId, arrangementId,
    hasSavedVersion, initialCachedSongDataRef, savedSongDataRef,
    isSharedContext, sharedOwnerName,
  };
}

function songRequestKey(artistSlug: string | undefined, slug: string | undefined, libraryLoaded: boolean) {
  return artistSlug && slug && libraryLoaded ? `${artistSlug}/${slug}` : null;
}

function applyLoadedSong(
  song: StoredSong,
  setCurrentSong: (song: StoredSong) => void,
  setSongData: (data: Section[]) => void,
  applySongPrefs: (song: StoredSong) => void,
  addToRecentes: (song: StoredSong) => void,
) {
  setCurrentSong(song);
  setSongData(song.songData);
  applySongPrefs(song);
  addToRecentes(song);
}
