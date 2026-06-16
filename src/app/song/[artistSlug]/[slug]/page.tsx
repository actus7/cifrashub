"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SongView } from "@/components/song/song-view";
import { SongViewProvider, type SongViewContextValue } from "@/components/song/song-context";
import { usePlayerStore } from "@/store/use-player-store";
import { useLibraryStore } from "@/store/use-library-store";
import type { Section, StoredSong, StoredSongUiPrefs } from "@/lib/types";
import { fetchChordsHtml } from "@/lib/fetch-proxy";
import { processHtmlAndExtract } from "@/lib/parser";
import { SongPageSkeleton } from "@/components/song/song-page-skeleton";
import { SongPageError } from "@/components/song/song-page-error";
import { useLibraryActions } from "@/hooks/use-library-actions";
import { useSession } from "@/hooks/use-session";
import { cloudAddSongToFolder, cloudRemoveSongFromFolder, cloudSaveRecentes, cloudUpdateSongPrefs, saveFolders, saveRecentes } from "@/lib/storage";
import { writeEditSnapshot, readEditResult, type EditOrigin } from "@/lib/cifras-edit-bridge";
import { arrangementKey, songIdentityKey } from "@/lib/stored-song-key";

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

  const lastRequestedRef = useRef("");

  const applyResult = useCallback((result: LoadSongResult) => {
    if (isLoadSongError(result)) {
      setError(result.error);
    } else {
      const savedSong = findSavedSong(result.song, foldersRef.current, recentesRef.current, folderIdRef.current, arrangementIdRef.current);
      const songData = reusableSavedContent(savedSong, arrangementIdRef.current) ?? result.song.songData;
      applyLoadedSong({ ...result.song, ...savedSong, songData }, setCurrentSong, setSongData, applySongPrefs, addToRecentesRef.current);
    }
  }, [applySongPrefs]);

  const load = useCallback(async () => {
    if (!artistSlug || !slug || !libraryLoaded) return;
    const requestKey = `${artistSlug}/${slug}`;
    lastRequestedRef.current = requestKey;
    setIsLoading(true);
    setError(null);

    const result = await loadSongResult(artistSlug, slug);
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

  const remainingFolders = folderId ? folders.filter((folder) => folder.id !== folderId) : folders;
  const fromFolders = remainingFolders
    .flatMap((folder) => folder.songs)
    .find((saved) => savedSongMatches(saved, song, arrangementId));
  if (fromFolders) return fromFolders;

  return recentes.find((saved) => savedSongMatches(saved, song, arrangementId));
}

function savedSongMatches(saved: StoredSong, song: StoredSong, arrangementId: string | null) {
  if (arrangementId) return arrangementKey(saved) === arrangementId;
  return songIdentityKey(saved) === songIdentityKey(song);
}

function reusableSavedContent(saved: StoredSong | undefined, arrangementId: string | null): Section[] | null {
  if (!saved || !arrangementId) return null;
  if (arrangementKey(saved) !== arrangementId) return null;
  return saved.songData;
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

function arePrefsEqual(song: StoredSong, prefs: PersistedPlayerPrefs) {
  return (
    (song.tone ?? 0) === prefs.tone &&
    (song.capo ?? 0) === prefs.capo &&
    (song.simplified ?? false) === prefs.simplified &&
    (song.showTabs ?? true) === prefs.showTabs &&
    (song.mirrored ?? false) === prefs.mirrored &&
    (song.fontSizeOffset ?? 0) === prefs.fontSizeOffset &&
    (song.columns ?? 1) === prefs.columns &&
    (song.spacingOffset ?? 0) === prefs.spacingOffset &&
    (song.zenMode ?? false) === prefs.zenMode &&
    (song.autoScroll ?? false) === prefs.autoScroll &&
    (song.scrollSpeed ?? 2) === prefs.scrollSpeed &&
    (song.metronomeActive ?? false) === prefs.metronomeActive &&
    (song.bpm ?? 100) === prefs.bpm
  );
}

function usePersistCurrentSongPrefs(
  currentSong: StoredSong | null,
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
  player: ReturnType<typeof usePlayerContextState>,
) {
  const { status } = useSession();
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
    const persistKey = JSON.stringify({ song: songIdentityKey(currentSong), prefs });
    if (lastPersistKeyRef.current === persistKey) return;
    lastPersistKeyRef.current = persistKey;

    if (arePrefsEqual(currentSong, prefs)) return;

    const currentKey = songIdentityKey(currentSong);
    let nextSong: StoredSong = currentSong;
    setCurrentSong((prev) => {
      if (!prev) return prev;
      nextSong = withPlayerPrefs(prev, prefs);
      return nextSong;
    });

    const { recentes, folders, setRecentes, setFolders } = useLibraryStore.getState();

    const nextRecentes = [
      nextSong,
      ...recentes.filter((song) => songIdentityKey(song) !== currentKey),
    ].slice(0, 15);
    saveRecentes(nextRecentes);
    setRecentes(nextRecentes);

    const isSavedInFolder = folders.some((folder) => folder.songs.some((song) => songIdentityKey(song) === currentKey));
    if (isSavedInFolder) {
      const nextFolders = folders.map((folder) => ({
        ...folder,
        songs: folder.songs.map((song) => songIdentityKey(song) === currentKey ? withPlayerPrefs(song, prefs) : song),
      }));
      saveFolders(nextFolders);
      setFolders(nextFolders);
    }
  }, [
    currentSong,
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
    setCurrentSong,
    status,
  ]);
}

type CloudPrefsPayload = { arrangementId: string; tone: number; capo: number; uiPrefs: StoredSongUiPrefs };

function flushPendingCloudPrefs(payload: CloudPrefsPayload) {
  try {
    fetch("/api/songs/prefs", {
      method: "PATCH",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
  }
}

function usePersistCloudSongPrefs(
  currentSong: StoredSong | null,
  player: ReturnType<typeof usePlayerContextState>,
) {
  const { status } = useSession();
  const lastPersistKeyRef = useRef("");
  const pendingPayloadRef = useRef<CloudPrefsPayload | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !currentSong?.arrangementId) return;

    const uiPrefs: StoredSongUiPrefs = {
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
    const payload: CloudPrefsPayload = {
      arrangementId: currentSong.arrangementId,
      tone: player.tone,
      capo: player.capo,
      uiPrefs,
    };
    const persistKey = JSON.stringify(payload);
    if (lastPersistKeyRef.current === persistKey) return;

    pendingPayloadRef.current = payload;
    const timeout = setTimeout(() => {
      lastPersistKeyRef.current = persistKey;
      pendingPayloadRef.current = null;
      void cloudUpdateSongPrefs(payload.arrangementId, payload).catch((error) => {
        console.error("Failed to persist song prefs in cloud", error);
      });
    }, 800);

    return () => clearTimeout(timeout);
  }, [
    currentSong,
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
    status,
  ]);

  useEffect(() => {
    return () => {
      if (pendingPayloadRef.current) flushPendingCloudPrefs(pendingPayloadRef.current);
    };
  }, []);
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

function useApplyEditResult(
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

  useEffect(() => {
    if (appliedRef.current || !currentSong || !artistSlug || !slug) return;
    const result = readEditResult();
    if (!result) return;
    appliedRef.current = true;
    if (!originMatchesRoute(result.origin, artistSlug, slug, folderId, arrangementId)) return;

    setSongData(result.songData);
    const editedSong: StoredSong = { ...currentSong, songData: result.songData };
    setCurrentSong((prev) => (prev ? { ...prev, songData: result.songData } : prev));

    const persist = status === "authenticated"
      ? persistEditedContentCloud(folderId, editedSong)
      : Promise.resolve(persistEditedContentLocal(folderId, editedSong));
    void persist.catch((error) => {
      console.error("Failed to persist edited song content", error);
    });
  }, [artistSlug, slug, folderId, arrangementId, currentSong, setCurrentSong, setSongData, status]);
}

function useSongPageActions(
  currentSong: StoredSong | null,
  songData: Section[],
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
  folderId: string | null,
  arrangementId: string | null,
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
        origin: {
          artistSlug: currentSong.artistSlug,
          slug: currentSong.slug,
          folderId,
          arrangementId,
        },
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
  const actions = useSongPageActions(
    songState.currentSong,
    songState.songData,
    songState.setCurrentSong,
    songState.folderId,
    songState.arrangementId,
  );
  usePersistCurrentSongPrefs(songState.currentSong, songState.setCurrentSong, actions.player);
  usePersistCloudSongPrefs(songState.currentSong, actions.player);
  useApplyEditResult(
    artistSlug,
    slug,
    songState.folderId,
    songState.arrangementId,
    songState.currentSong,
    songState.setCurrentSong,
    songState.setSongData,
  );
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
