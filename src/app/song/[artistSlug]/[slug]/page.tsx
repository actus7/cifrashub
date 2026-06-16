"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SongView } from "@/components/song/song-view";
import { SongViewProvider, type SongViewContextValue } from "@/components/song/song-context";
import { usePlayerStore } from "@/store/use-player-store";
import { useLibraryStore } from "@/store/use-library-store";
import type { Section, StoredSong } from "@/lib/types";
import { fetchChordsHtml } from "@/lib/fetch-proxy";
import { processHtmlAndExtract } from "@/lib/parser";
import { SongPageSkeleton } from "@/components/song/song-page-skeleton";
import { SongPageError } from "@/components/song/song-page-error";
import { useLibraryActions } from "@/hooks/use-library-actions";
import { useSession } from "@/hooks/use-session";
import { cloudAddSongToFolder, cloudRemoveSongFromFolder, saveFolders, saveRecentes } from "@/lib/storage";
import { writeEditSnapshot } from "@/lib/cifras-edit-bridge";
import { songIdentityKey } from "@/lib/stored-song-key";

function useSongParams() {
  const params = useParams();
  return {
    artistSlug: Array.isArray(params.artistSlug) ? params.artistSlug[0] : params.artistSlug,
    slug: Array.isArray(params.slug) ? params.slug[0] : params.slug,
  };
}

function useLoadedSong(artistSlug: string | undefined, slug: string | undefined) {
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

  // addToRecentes changes identity whenever the recentes store changes, and
  // load() itself mutates that store. Keep it in a ref so load's identity (and
  // thus the load effect below) only depends on the song being viewed —
  // otherwise loading a song retriggers the effect in an infinite fetch loop.
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

  // Guards against a stale fetch winning: when the user navigates between songs
  // quickly, multiple load()s race and the last to resolve would otherwise
  // overwrite the state with the wrong song.
  const lastRequestedRef = useRef("");

  const applyResult = useCallback((result: LoadSongResult) => {
    if (isLoadSongError(result)) {
      setError(result.error);
    } else {
      const savedSong = findSavedSong(result.song, foldersRef.current, recentesRef.current, folderIdRef.current, arrangementIdRef.current);
      applyLoadedSong({ ...result.song, ...savedSong, songData: result.song.songData }, setCurrentSong, setSongData, applySongPrefs, addToRecentesRef.current);
    }
  }, [applySongPrefs]);

  const load = useCallback(async () => {
    if (!artistSlug || !slug || !libraryLoaded) return;
    const requestKey = `${artistSlug}/${slug}`;
    lastRequestedRef.current = requestKey;
    setIsLoading(true);
    setError(null);

    const result = await loadSongResult(artistSlug, slug);
    // Ignore a result that a newer navigation has already superseded.
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

  return { currentSong, setCurrentSong, songData, isLoading, error, load };
}

function findSavedSong(
  song: StoredSong,
  folders: ReturnType<typeof useLibraryStore.getState>["folders"],
  recentes: StoredSong[],
  folderId: string | null,
  arrangementId: string | null,
) {
  if (folderId) {
    const fromFolder = folders
      .find((folder) => folder.id === folderId)
      ?.songs.find((saved) => savedSongMatches(saved, song, arrangementId));
    if (fromFolder) return fromFolder;
  }

  const fromFolders = folders
    .flatMap((folder) => folder.songs)
    .find((saved) => savedSongMatches(saved, song, arrangementId));
  if (fromFolders) return fromFolders;

  return recentes.find((saved) => savedSongMatches(saved, song, arrangementId));
}

function savedSongMatches(saved: StoredSong, song: StoredSong, arrangementId: string | null) {
  if (arrangementId && (saved.arrangementId === arrangementId || saved.id === arrangementId)) return true;
  return songIdentityKey(saved) === songIdentityKey(song);
}

type LoadSongResult = { song: StoredSong } | { error: Error };

async function loadSongResult(artistSlug: string, slug: string): Promise<LoadSongResult> {
  try {
    const html = await fetchChordsHtml(artistSlug, slug);
    return { song: processHtmlAndExtract(html, `${artistSlug}-${slug}`, "", "", artistSlug, slug) };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Erro desconhecido.") };
  }
}

function isLoadSongError(result: LoadSongResult): result is { error: Error } {
  return "error" in result;
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

type PersistedPlayerPrefs = Pick<StoredSong,
  | "tone"
  | "capo"
  | "simplified"
  | "showTabs"
  | "mirrored"
  | "fontSizeOffset"
  | "columns"
  | "spacingOffset"
  | "zenMode"
  | "autoScroll"
  | "scrollSpeed"
  | "metronomeActive"
  | "bpm"
>;

function usePlayerContextState() {
  return {
    tone: usePlayerStore((s) => s.tone),
    setTone: usePlayerStore((s) => s.setTone),
    capo: usePlayerStore((s) => s.capo),
    setCapo: usePlayerStore((s) => s.setCapo),
    simplified: usePlayerStore((s) => s.simplified),
    setSimplified: usePlayerStore((s) => s.setSimplified),
    showTabs: usePlayerStore((s) => s.showTabs),
    setShowTabs: usePlayerStore((s) => s.setShowTabs),
    mirrored: usePlayerStore((s) => s.mirrored),
    setMirrored: usePlayerStore((s) => s.setMirrored),
    fontSizeOffset: usePlayerStore((s) => s.fontSizeOffset),
    setFontSizeOffset: usePlayerStore((s) => s.setFontSizeOffset),
    columns: usePlayerStore((s) => s.columns),
    setColumns: usePlayerStore((s) => s.setColumns),
    spacingOffset: usePlayerStore((s) => s.spacingOffset),
    setSpacingOffset: usePlayerStore((s) => s.setSpacingOffset),
    zenMode: usePlayerStore((s) => s.zenMode),
    setZenMode: usePlayerStore((s) => s.setZenMode),
    autoScroll: usePlayerStore((s) => s.autoScroll),
    setAutoScroll: usePlayerStore((s) => s.setAutoScroll),
    scrollSpeed: usePlayerStore((s) => s.scrollSpeed),
    setScrollSpeed: usePlayerStore((s) => s.setScrollSpeed),
    metronomeActive: usePlayerStore((s) => s.metronomeActive),
    setMetronomeActive: usePlayerStore((s) => s.setMetronomeActive),
    bpm: usePlayerStore((s) => s.bpm),
    setBpm: usePlayerStore((s) => s.setBpm),
    activeChord: usePlayerStore((s) => s.activeChord),
    setActiveChord: usePlayerStore((s) => s.setActiveChord),
    displaySettingsOpen: usePlayerStore((s) => s.displaySettingsOpen),
    setDisplaySettingsOpen: usePlayerStore((s) => s.setDisplaySettingsOpen),
    youtubeMiniOpen: usePlayerStore((s) => s.youtubeMiniOpen),
    setYoutubeMiniOpen: usePlayerStore((s) => s.setYoutubeMiniOpen),
  };
}

function songMatches(a: StoredSong | null | undefined, b: StoredSong | null) {
  return Boolean(a && b && a.artistSlug === b.artistSlug && a.slug === b.slug);
}

function withPlayerPrefs(song: StoredSong, prefs: PersistedPlayerPrefs): StoredSong {
  return { ...song, ...prefs };
}

function usePersistCurrentSongPrefs(
  currentSong: StoredSong | null,
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
  player: ReturnType<typeof usePlayerContextState>,
) {
  const { status } = useSession();
  const folders = useLibraryStore((s) => s.folders);
  const setFolders = useLibraryStore((s) => s.setFolders);
  const recentes = useLibraryStore((s) => s.recentes);
  const setRecentes = useLibraryStore((s) => s.setRecentes);
  const lastPersistKeyRef = useRef("");

  useEffect(() => {
    if (status !== "unauthenticated" || !currentSong) return;

    const prefs: PersistedPlayerPrefs = {
      tone: player.tone,
      capo: player.capo,
      simplified: player.simplified,
      showTabs: player.showTabs,
      mirrored: player.mirrored,
      fontSizeOffset: player.fontSizeOffset,
      columns: player.columns,
      spacingOffset: player.spacingOffset,
      zenMode: player.zenMode,
      autoScroll: player.autoScroll,
      scrollSpeed: player.scrollSpeed,
      metronomeActive: player.metronomeActive,
      bpm: player.bpm,
    };
    const nextSong = withPlayerPrefs(currentSong, prefs);
    const persistKey = JSON.stringify({ song: songIdentityKey(currentSong), prefs });
    if (lastPersistKeyRef.current === persistKey) return;
    lastPersistKeyRef.current = persistKey;

    setCurrentSong((prev) => prev ? withPlayerPrefs(prev, prefs) : prev);

    const nextRecentes = [
      nextSong,
      ...recentes.filter((song) => songIdentityKey(song) !== songIdentityKey(currentSong)),
    ].slice(0, 15);
    saveRecentes(nextRecentes);
    setRecentes(nextRecentes);

    const nextFolders = folders.map((folder) => ({
      ...folder,
      songs: folder.songs.map((song) => songIdentityKey(song) === songIdentityKey(currentSong) ? withPlayerPrefs(song, prefs) : song),
    }));
    saveFolders(nextFolders);
    setFolders(nextFolders);
  }, [
    currentSong,
    folders,
    player.autoScroll,
    player.bpm,
    player.capo,
    player.columns,
    player.fontSizeOffset,
    player.metronomeActive,
    player.mirrored,
    player.scrollSpeed,
    player.showTabs,
    player.simplified,
    player.spacingOffset,
    player.tone,
    player.zenMode,
    recentes,
    setCurrentSong,
    setFolders,
    setRecentes,
    status,
  ]);
}

function useSongFolderActions(currentSong: StoredSong | null) {
  const { status } = useSession();
  const isCloud = status === "authenticated";
  const { doCreateFolder, notifyCloudMutation } = useLibraryActions();
  const folders = useLibraryStore((s) => s.folders);
  const setFolders = useLibraryStore((s) => s.setFolders);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const isSavedInAnyFolder = currentSong ? folders.some((f) => f.songs.some((s) => songMatches(s, currentSong))) : false;

  const onToggleSongInFolder = useCallback(async (folderId: string) => {
    const isSaved = folders.some((f) => f.id === folderId && f.songs.some((s) => songMatches(s, currentSong)));

    if (isCloud) {
      await toggleCloudSongFolder(folderId, folders, currentSong, isSaved, setFolders, notifyCloudMutation);
      return;
    }

    const next = toggleLocalSongFolder(folderId, folders, currentSong, isSaved);
    saveFolders(next);
    setFolders(next);
  }, [currentSong, folders, isCloud, notifyCloudMutation, setFolders]);

  const onCreateFolderFromSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await doCreateFolder(newFolderName.trim());
    setNewFolderName("");
  }, [doCreateFolder, newFolderName]);

  return {
    folders,
    saveModalOpen,
    setSaveModalOpen,
    newFolderName,
    setNewFolderName,
    isSavedInAnyFolder,
    onToggleSongInFolder,
    onCreateFolderFromSave,
  };
}

async function toggleCloudSongFolder(
  folderId: string,
  folders: ReturnType<typeof useLibraryStore.getState>["folders"],
  currentSong: StoredSong | null,
  isSaved: boolean,
  setFolders: (folders: ReturnType<typeof useLibraryStore.getState>["folders"]) => void,
  notifyCloudMutation: () => void,
) {
  try {
    const next = isSaved
      ? await removeCloudSongFromFolder(folderId, folders, currentSong)
      : await addCloudSongToFolder(folderId, currentSong);

    if (!next) return;
    setFolders(next);
    notifyCloudMutation();
  } catch (err) {
    console.error("Error toggling folder", err);
  }
}

async function removeCloudSongFromFolder(
  folderId: string,
  folders: ReturnType<typeof useLibraryStore.getState>["folders"],
  currentSong: StoredSong | null,
) {
  const songInFolder = folders.find((f) => f.id === folderId)?.songs.find((s) => songMatches(s, currentSong));
  if (!songInFolder) return null;
  const { folders: next } = await cloudRemoveSongFromFolder(folderId, songInFolder.arrangementId || songInFolder.id);
  return next;
}

async function addCloudSongToFolder(folderId: string, currentSong: StoredSong | null) {
  if (!currentSong) return null;
  const { folders: next } = await cloudAddSongToFolder(folderId, currentSong);
  return next;
}

function toggleLocalSongFolder(
  folderId: string,
  folders: ReturnType<typeof useLibraryStore.getState>["folders"],
  currentSong: StoredSong | null,
  isSaved: boolean,
) {
  return folders.map((folder) => {
    if (folder.id !== folderId) return folder;
    if (isSaved) return { ...folder, songs: folder.songs.filter((song) => !songMatches(song, currentSong)) };
    if (currentSong) return { ...folder, songs: [...folder.songs, currentSong] };
    return folder;
  });
}

function useSongPageActions(
  currentSong: StoredSong | null,
  songData: Section[],
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
) {
  const router = useRouter();
  const player = usePlayerContextState();

  return {
    player,
    onYoutubeVideoResolved: (youtubeId: string) => setCurrentSong((prev) => prev ? { ...prev, youtubeId } : prev),
    onBack: () => router.back(),
    onOpenVideo: () => player.setYoutubeMiniOpen(true),
    onOpenArtistSongs: () => {
      if (currentSong) router.push(`/artist/${currentSong.artistSlug}`);
    },
    onPrint: () => window.print(),
    onTapZone: () => {},
    onToggleZen: () => player.setZenMode(!usePlayerStore.getState().zenMode),
    onOpenSongEditor: () => {
      if (!currentSong) return;
      const ps = usePlayerStore.getState();
      writeEditSnapshot({
        v: 1,
        currentSong,
        songData,
        songReturnTarget: "home",
        activeFolderId: null,
        setlistDetail: null,
        activeArtist: null,
        display: {
          tone: ps.tone,
          capo: ps.capo,
          simplified: ps.simplified,
          showTabs: ps.showTabs,
          mirrored: ps.mirrored,
          fontSizeOffset: ps.fontSizeOffset,
          columns: ps.columns,
          spacingOffset: ps.spacingOffset,
        },
      });
      router.push("/editar");
    },
    onShareArrangement: () => {
      if (typeof window !== "undefined" && navigator?.clipboard) {
        void navigator.clipboard.writeText(window.location.href);
      }
    },
  };
}

function useSongContextValue({
  currentSong,
  songData,
  folderState,
  actions,
}: {
  currentSong: StoredSong | null;
  songData: Section[];
  folderState: ReturnType<typeof useSongFolderActions>;
  actions: ReturnType<typeof useSongPageActions>;
}) {
  const p = actions.player;
  const youtubeEmbedUrl = currentSong?.youtubeId ? `https://www.youtube.com/embed/${currentSong.youtubeId}` : null;

  return useMemo(() => ({
    currentSong,
    songData,
    isParsing: false,
    parseError: null,
    ...p,
    effectiveTransposition: p.tone - p.capo,
    ...folderState,
    youtubeEmbedUrl,
    youtubeFallbackSearchQuery: currentSong ? currentSong.title + " " + currentSong.artist : "",
    onYoutubeVideoResolved: actions.onYoutubeVideoResolved,
    onBack: actions.onBack,
    onOpenVideo: actions.onOpenVideo,
    onOpenArtistSongs: actions.onOpenArtistSongs,
    onPrint: actions.onPrint,
    onTapZone: actions.onTapZone,
    onToggleZen: actions.onToggleZen,
    onOpenSongEditor: actions.onOpenSongEditor,
    onShareArrangement: actions.onShareArrangement,
    shareArrangementDisabled: false,
  }), [actions, currentSong, folderState, p, songData, youtubeEmbedUrl]);
}

export default function SongPage() {
  const { artistSlug, slug } = useSongParams();
  const songState = useLoadedSong(artistSlug, slug);
  const folderState = useSongFolderActions(songState.currentSong);
  const actions = useSongPageActions(songState.currentSong, songState.songData, songState.setCurrentSong);
  usePersistCurrentSongPrefs(songState.currentSong, songState.setCurrentSong, actions.player);
  const value = useSongContextValue({ currentSong: songState.currentSong, songData: songState.songData, folderState, actions });

  if (songState.isLoading) return <SongPageSkeleton />;
  if (songState.error) return <SongPageError error={songState.error} onRetry={songState.load} />;
  if (!songState.currentSong) return <SongPageError error={new Error("Cifra não encontrada.")} onRetry={songState.load} />;

  return (
    <SongViewProvider value={value as SongViewContextValue}>
      <SongView />
    </SongViewProvider>
  );
}
