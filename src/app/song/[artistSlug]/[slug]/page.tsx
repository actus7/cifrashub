"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
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
import { arrangementKey } from "@/lib/arrangement-key";
import { songIdentityKey } from "@/lib/song-identity-key";

function useSongParams() {
  const params = useParams();
  return {
    artistSlug: Array.isArray(params.artistSlug) ? params.artistSlug[0] : params.artistSlug,
    slug: Array.isArray(params.slug) ? params.slug[0] : params.slug,
  };
}

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

  const refs = useLoadedSongRefs({ addToRecentes, arrangementId, folderId, folders, recentes });
  const lastRequestedRef = useRef("");

  const applyResult = useCallback((result: LoadSongResult) => {
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

function findSavedSong(
  song: StoredSong,
  folders: ReturnType<typeof useLibraryStore.getState>["folders"],
  recentes: StoredSong[],
  folderId: string | null,
  arrangementId: string | null,
) {
  return savedSongCandidates(folders, recentes, folderId)
    .find((saved) => savedSongMatches(saved, song, arrangementId));
}

function savedSongCandidates(
  folders: ReturnType<typeof useLibraryStore.getState>["folders"],
  recentes: StoredSong[],
  folderId: string | null,
) {
  return [...preferredFolderSongs(folders, folderId), ...otherFolderSongs(folders, folderId), ...recentes];
}

function preferredFolderSongs(folders: ReturnType<typeof useLibraryStore.getState>["folders"], folderId: string | null) {
  return folderId ? folders.find((folder) => folder.id === folderId)?.songs ?? [] : [];
}

function otherFolderSongs(folders: ReturnType<typeof useLibraryStore.getState>["folders"], folderId: string | null) {
  return folders
    .filter((folder) => folder.id !== folderId)
    .flatMap((folder) => folder.songs);
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

const PLAYER_PREF_DEFAULTS = {
  tone: 0,
  capo: 0,
  simplified: false,
  showTabs: true,
  mirrored: false,
  fontSizeOffset: 0,
  columns: 1,
  spacingOffset: 0,
  zenMode: false,
  autoScroll: false,
  scrollSpeed: 2,
  metronomeActive: false,
  bpm: 100,
};

const PLAYER_PREF_KEYS = Object.keys(PLAYER_PREF_DEFAULTS) as Array<keyof typeof PLAYER_PREF_DEFAULTS>;

type PersistedPlayerPrefs = Pick<StoredSong, keyof typeof PLAYER_PREF_DEFAULTS>;
type PlayerContextState = ReturnType<typeof usePlayerContextState>;

function usePitchState() {
  return {
    tone: usePlayerStore((s) => s.tone),
    setTone: usePlayerStore((s) => s.setTone),
    capo: usePlayerStore((s) => s.capo),
    setCapo: usePlayerStore((s) => s.setCapo),
  };
}

function useDisplayState() {
  return {
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
  };
}

function usePracticeState() {
  return {
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
  };
}

function useOverlayState() {
  return {
    activeChord: usePlayerStore((s) => s.activeChord),
    setActiveChord: usePlayerStore((s) => s.setActiveChord),
    displaySettingsOpen: usePlayerStore((s) => s.displaySettingsOpen),
    setDisplaySettingsOpen: usePlayerStore((s) => s.setDisplaySettingsOpen),
    youtubeMiniOpen: usePlayerStore((s) => s.youtubeMiniOpen),
    setYoutubeMiniOpen: usePlayerStore((s) => s.setYoutubeMiniOpen),
  };
}

function usePlayerContextState() {
  return {
    ...usePitchState(),
    ...useDisplayState(),
    ...usePracticeState(),
    ...useOverlayState(),
  };
}

function songMatches(a: StoredSong | null | undefined, b: StoredSong | null) {
  return Boolean(a && b && a.artistSlug === b.artistSlug && a.slug === b.slug);
}

function withPlayerPrefs(song: StoredSong, prefs: PersistedPlayerPrefs): StoredSong {
  return { ...song, ...prefs };
}

function arePrefsEqual(song: StoredSong, prefs: PersistedPlayerPrefs) {
  return PLAYER_PREF_KEYS.every((key) => (song[key] ?? PLAYER_PREF_DEFAULTS[key]) === prefs[key]);
}

function playerPrefs(player: PlayerContextState): PersistedPlayerPrefs {
  return Object.fromEntries(PLAYER_PREF_KEYS.map((key) => [key, player[key]])) as PersistedPlayerPrefs;
}

function usePersistCurrentSongPrefs(
  currentSong: StoredSong | null,
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
  player: PlayerContextState,
) {
  const { status } = useSession();
  const lastPersistKeyRef = useRef("");
  const prefs = playerPrefs(player);
  const persistKey = currentSong ? JSON.stringify({ song: songIdentityKey(currentSong), prefs }) : "";

  useEffect(() => {
    if (!shouldPersistLocalPrefs(status, currentSong, persistKey, lastPersistKeyRef) || !currentSong) return;
    lastPersistKeyRef.current = persistKey;
    if (arePrefsEqual(currentSong, prefs)) return;
    persistLocalPrefs(currentSong, prefs, setCurrentSong);
  }, [currentSong, persistKey, prefs, setCurrentSong, status]);
}

function shouldPersistLocalPrefs(
  status: ReturnType<typeof useSession>["status"],
  currentSong: StoredSong | null,
  persistKey: string,
  lastPersistKeyRef: MutableRefObject<string>,
) {
  return status === "unauthenticated" && currentSong && lastPersistKeyRef.current !== persistKey;
}

function persistLocalPrefs(
  currentSong: StoredSong,
  prefs: PersistedPlayerPrefs,
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
) {
  const currentKey = songIdentityKey(currentSong);
  const nextSong = updateCurrentSongPrefs(setCurrentSong, prefs, currentSong);
  persistRecentSongPrefs(currentKey, nextSong);
  persistFolderSongPrefs(currentKey, prefs);
}

function updateCurrentSongPrefs(
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
  prefs: PersistedPlayerPrefs,
  fallback: StoredSong,
) {
  let nextSong = fallback;
  setCurrentSong((prev) => {
    if (!prev) return prev;
    nextSong = withPlayerPrefs(prev, prefs);
    return nextSong;
  });
  return nextSong;
}

function persistRecentSongPrefs(currentKey: string, nextSong: StoredSong) {
  const { recentes, setRecentes } = useLibraryStore.getState();
  const nextRecentes = [nextSong, ...recentes.filter((song) => songIdentityKey(song) !== currentKey)].slice(0, 15);
  saveRecentes(nextRecentes);
  setRecentes(nextRecentes);
}

function persistFolderSongPrefs(currentKey: string, prefs: PersistedPlayerPrefs) {
  const { folders, setFolders } = useLibraryStore.getState();
  if (!folders.some((folder) => folder.songs.some((song) => songIdentityKey(song) === currentKey))) return;
  const nextFolders = folders.map((folder) => ({
    ...folder,
    songs: folder.songs.map((song) => songIdentityKey(song) === currentKey ? withPlayerPrefs(song, prefs) : song),
  }));
  saveFolders(nextFolders);
  setFolders(nextFolders);
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

function usePersistCloudSongPrefs(currentSong: StoredSong | null, player: PlayerContextState) {
  const { status } = useSession();
  const lastPersistKeyRef = useRef("");
  const pendingPayloadRef = useRef<CloudPrefsPayload | null>(null);
  const payload = currentSong?.arrangementId ? cloudPrefsPayload(currentSong.arrangementId, player) : null;
  const persistKey = payload ? JSON.stringify(payload) : "";

  useEffect(() => {
    if (!shouldPersistCloudPrefs(status, payload, persistKey, lastPersistKeyRef) || !payload) return;
    pendingPayloadRef.current = payload;
    const timeout = setTimeout(() => persistCloudPrefs(payload, persistKey, lastPersistKeyRef, pendingPayloadRef), 800);
    return () => clearTimeout(timeout);
  }, [payload, persistKey, status]);

  useEffect(() => {
    return () => {
      if (pendingPayloadRef.current) flushPendingCloudPrefs(pendingPayloadRef.current);
    };
  }, []);
}

function cloudPrefsPayload(arrangementId: string, player: PlayerContextState): CloudPrefsPayload {
  return {
    arrangementId,
    tone: player.tone,
    capo: player.capo,
    uiPrefs: uiPrefs(player),
  };
}

function uiPrefs(player: PlayerContextState): StoredSongUiPrefs {
  const prefs = playerPrefs(player);
  return Object.fromEntries(
    PLAYER_PREF_KEYS.filter((key) => key !== "tone" && key !== "capo").map((key) => [key, prefs[key]]),
  ) as StoredSongUiPrefs;
}

function shouldPersistCloudPrefs(
  status: ReturnType<typeof useSession>["status"],
  payload: CloudPrefsPayload | null,
  persistKey: string,
  lastPersistKeyRef: MutableRefObject<string>,
) {
  return status === "authenticated" && payload && lastPersistKeyRef.current !== persistKey;
}

function persistCloudPrefs(
  payload: CloudPrefsPayload,
  persistKey: string,
  lastPersistKeyRef: MutableRefObject<string>,
  pendingPayloadRef: MutableRefObject<CloudPrefsPayload | null>,
) {
  lastPersistKeyRef.current = persistKey;
  pendingPayloadRef.current = null;
  void cloudUpdateSongPrefs(payload.arrangementId, payload).catch((error) => {
    console.error("Failed to persist song prefs in cloud", error);
  });
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

function canApplyEditResult({ appliedRef, currentSong, artistSlug, slug }: ApplyEditResultArgs) {
  return !appliedRef.current && Boolean(currentSong && artistSlug && slug);
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
          arrangementId: arrangementId ?? arrangementKey(currentSong),
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
