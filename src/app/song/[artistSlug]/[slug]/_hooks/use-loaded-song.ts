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
};

function useLoadedSongRefs({ addToRecentes, arrangementId, folderId, folders, recentes }: LoadedSongRefsArgs) {
  const addToRecentesRef = useRef(addToRecentes);
  const foldersRef = useRef(folders);
  const recentesRef = useRef(recentes);
  const folderIdRef = useRef(folderId);
  const arrangementIdRef = useRef(arrangementId);

  useEffect(() => {
    addToRecentesRef.current = addToRecentes;
    foldersRef.current = folders;
    recentesRef.current = recentes;
    folderIdRef.current = folderId;
    arrangementIdRef.current = arrangementId;
  }, [addToRecentes, arrangementId, folderId, folders, recentes]);

  return useMemo(() => ({
    addToRecentes: addToRecentesRef,
    arrangementId: arrangementIdRef,
    folderId: folderIdRef,
    folders: foldersRef,
    recentes: recentesRef,
  }), []);
}

export function useLoadedSong(artistSlug: string | undefined, slug: string | undefined) {
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folderId");
  const arrangementId = searchParams.get("arrangementId");
  const [currentSong, setCurrentSong] = useState<StoredSong | null>(null);
  const [songData, setSongData] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const applySongPrefs = usePlayerStore((s) => s.applySongPrefs);
  const { addToRecentes } = useLibraryActions();
  const folders = useLibraryStore((s) => s.folders);
  const recentes = useLibraryStore((s) => s.recentes);
  const libraryLoaded = useLibraryStore((s) => s.libraryLoaded);

  const refs = useLoadedSongRefs({ addToRecentes, arrangementId, folderId, folders, recentes });
  const lastRequestedRef = useRef("");

  const applyResult = useCallback((result: Awaited<ReturnType<typeof loadSongResult>>) => {
    if (isLoadSongError(result)) {
      setError(result.error);
    } else {
      const savedSong = findSavedSong(result.song, refs.folders.current, refs.recentes.current, refs.folderId.current, refs.arrangementId.current);
      const songData = reusableSavedContent(savedSong, refs.arrangementId.current) ?? result.song.songData;
      applyLoadedSong({ ...result.song, ...savedSong, songData }, setCurrentSong, setSongData, applySongPrefs, refs.addToRecentes.current);
    }
  }, [applySongPrefs, refs]);

  const load = useCallback(async () => {
    const requestKey = songRequestKey(artistSlug, slug, libraryLoaded);
    if (!requestKey) return;
    lastRequestedRef.current = requestKey;
    setIsLoading(true);
    setError(null);

    const result = await loadSongResult(artistSlug!, slug!);
    if (lastRequestedRef.current !== requestKey) return;

    applyResult(result);
    setIsLoading(false);
  }, [applyResult, artistSlug, libraryLoaded, slug]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [load]);

  return { currentSong, setCurrentSong, songData, setSongData, isLoading, error, load, folderId, arrangementId };
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
