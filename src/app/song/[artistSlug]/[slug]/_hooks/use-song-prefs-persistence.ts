import { useEffect, useRef, type MutableRefObject } from "react";
import { useSession } from "@/hooks/use-session";
import { cloudUpdateSongPrefs, saveFolders, saveRecentes } from "@/lib/storage";
import type { StoredSong, StoredSongUiPrefs } from "@/lib/types";
import { PLAYER_PREF_DEFAULTS, PLAYER_PREF_KEYS } from "@/lib/player-pref-defaults";
import { songIdentityKey } from "@/lib/song-identity-key";
import { useLibraryStore } from "@/store/use-library-store";
import type { PlayerContextState } from "./use-player-context-state";

export type PersistedPlayerPrefs = Pick<StoredSong, keyof typeof PLAYER_PREF_DEFAULTS>;

type CloudPrefsPayload = { arrangementId: string; tone: number; capo: number; uiPrefs: StoredSongUiPrefs };

function withPlayerPrefs(song: StoredSong, prefs: PersistedPlayerPrefs): StoredSong {
  return { ...song, ...prefs };
}

function arePrefsEqual(song: StoredSong, prefs: PersistedPlayerPrefs) {
  return PLAYER_PREF_KEYS.every((key) => (song[key] ?? PLAYER_PREF_DEFAULTS[key]) === prefs[key]);
}

function playerPrefs(player: PlayerContextState): PersistedPlayerPrefs {
  return Object.fromEntries(PLAYER_PREF_KEYS.map((key) => [key, player[key]])) as PersistedPlayerPrefs;
}

export function usePersistCurrentSongPrefs(
  currentSong: StoredSong | null,
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
  player: PlayerContextState,
) {
  const { status } = useSession();
  const lastPersistKeyRef = useRef("");
  const prefs = playerPrefs(player);
  const persistKey = currentSong ? JSON.stringify({ song: songIdentityKey(currentSong), prefs }) : "";
  const prefsRef = useRef(prefs);
  const currentSongRef = useRef(currentSong);

  useEffect(() => {
    prefsRef.current = prefs;
    currentSongRef.current = currentSong;
  }, [currentSong, prefs]);

  useEffect(() => {
    const activeSong = currentSongRef.current;
    const activePrefs = prefsRef.current;
    if (!shouldPersistLocalPrefs(status, activeSong, persistKey, lastPersistKeyRef) || !activeSong) return;
    lastPersistKeyRef.current = persistKey;
    if (arePrefsEqual(activeSong, activePrefs)) return;
    persistLocalPrefs(activeSong, activePrefs, setCurrentSong);
  }, [persistKey, setCurrentSong, status]);
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

export function usePersistCloudSongPrefs(currentSong: StoredSong | null, player: PlayerContextState) {
  const { status } = useSession();
  const lastPersistKeyRef = useRef("");
  const pendingPayloadRef = useRef<CloudPrefsPayload | null>(null);
  const payload = currentSong?.arrangementId ? cloudPrefsPayload(currentSong.arrangementId, player) : null;
  const persistKey = payload ? JSON.stringify(payload) : "";
  const payloadRef = useRef(payload);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    const currentPayload = payloadRef.current;
    if (!shouldPersistCloudPrefs(status, currentPayload, persistKey, lastPersistKeyRef) || !currentPayload) return;
    pendingPayloadRef.current = currentPayload;
    const timeout = setTimeout(() => persistCloudPrefs(currentPayload, persistKey, lastPersistKeyRef, pendingPayloadRef), 800);
    return () => clearTimeout(timeout);
  }, [persistKey, status]);

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
