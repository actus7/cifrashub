import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useSession } from "@/hooks/use-session";
import { cloudUpdateSongPrefs, saveFolders, saveRecentes } from "@/lib/storage";
import type { StoredSong, StoredSongUiPrefs } from "@/lib/types";
import { songIdentityKey } from "@/lib/song-identity-key";
import { useLibraryStore } from "@/store/use-library-store";
import type { PlayerContextState } from "./use-player-context-state";
import {
  arePrefsEqual,
  applyPrefsToFolders,
  applyPrefsToRecentes,
  playerPrefs,
  uiPrefs,
  withPlayerPrefs,
  type PersistedPlayerPrefs,
} from "../_lib/song-prefs-helpers";

type CloudPrefsPayload = { arrangementId: string; tone: number; capo: number; uiPrefs: StoredSongUiPrefs };

// ── usePersistCurrentSongPrefs ───────────────────────────────────────────────

/**
 * Persists player prefs (tone, capo, display settings) into the in-memory
 * song object and the library store.
 *
 * - **Unauthenticated**: also writes to localStorage (saveFolders / saveRecentes).
 * - **Authenticated**: updates Zustand only — the cloud sync provider handles
 *   durable storage, and cloud-refresh refetches will overwrite anyway.
 */
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
    if (!activeSong || lastPersistKeyRef.current === persistKey) return;
    lastPersistKeyRef.current = persistKey;
    if (arePrefsEqual(activeSong, activePrefs)) return;
    applyPrefsToSong(activeSong, activePrefs, status, setCurrentSong);
  }, [persistKey, setCurrentSong, status]);
}

function applyPrefsToSong(
  currentSong: StoredSong,
  prefs: PersistedPlayerPrefs,
  status: ReturnType<typeof useSession>["status"],
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
) {
  const currentKey = songIdentityKey(currentSong);
  const nextSong = withPlayerPrefs(currentSong, prefs);
  setCurrentSong((prev) => (prev ? withPlayerPrefs(prev, prefs) : null));

  // Always update Zustand in-memory store so SPA navigation and folder saves
  // see the fresh tone/capo.
  const { recentes, setRecentes, folders, setFolders } = useLibraryStore.getState();
  const nextRecentes = applyPrefsToRecentes(recentes, currentKey, nextSong);
  setRecentes(nextRecentes);

  const nextFolders = applyPrefsToFolders(folders, currentKey, prefs);
  if (nextFolders !== folders) setFolders(nextFolders);

  // Only persist to localStorage for unauthenticated users.
  // Cloud users: the sync-provider handles durable storage.
  if (status === "unauthenticated") {
    saveRecentes(nextRecentes);
    if (nextFolders !== folders) saveFolders(nextFolders);
  }
}

// ── usePersistCloudSongPrefs ─────────────────────────────────────────────────

type PendingPrefs = { identity: string; tone: number; capo: number; uiPrefs: StoredSongUiPrefs };

/**
 * Persists player prefs to the cloud via PATCH /api/songs/prefs.
 *
 * - Debounced at 800 ms to avoid excessive API calls.
 * - If `arrangementId` is missing (song not yet saved to a folder), the latest
 *   prefs are kept in a ref. When `arrangementId` appears (e.g. after the user
 *   saves the song), the pending prefs are flushed immediately.
 * - On component unmount, any pending (debounced) payload is sent via
 *   `keepalive` fetch so the browser can complete it during navigation.
 */
export function usePersistCloudSongPrefs(
  currentSong: StoredSong | null,
  player: PlayerContextState,
  isSharedContext = false,
) {
  const { status } = useSession();
  const lastPersistKeyRef = useRef("");
  const pendingPayloadRef = useRef<CloudPrefsPayload | null>(null);
  const latestPrefsRef = useRef<PendingPrefs | null>(null);
  const prevArrangementIdRef = useRef<string | undefined>(currentSong?.arrangementId);
  const currentSongRef = useRef(currentSong);

  const arrangementId = currentSong?.arrangementId;
  const identity = currentSong ? songIdentityKey(currentSong) : "";
  const tone = player.tone;
  const capo = player.capo;
  const ui = uiPrefs(player);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  // Always keep the latest prefs so we can flush when arrangementId appears.
  useEffect(() => {
    if (currentSong) {
      latestPrefsRef.current = { identity, tone, capo, uiPrefs: ui };
    }
  });

  // Flush pending prefs when arrangementId transitions from null → string.
  useEffect(() => {
    const prev = prevArrangementIdRef.current;
    prevArrangementIdRef.current = arrangementId;

    if (!arrangementId || prev || isSharedContext) return; // only on first appearance
    const pending = latestPrefsRef.current;
    if (!pending || pending.identity !== identity) return;

    const payload: CloudPrefsPayload = {
      arrangementId,
      tone: pending.tone,
      capo: pending.capo,
      uiPrefs: pending.uiPrefs,
    };
    // Mark as flushed so the debounce effect doesn't re-send identical prefs.
    lastPersistKeyRef.current = JSON.stringify(payload);
    latestPrefsRef.current = null;
    void cloudUpdateSongPrefs(arrangementId, payload, currentSongRef.current ?? undefined).catch((error) => {
      console.error("Failed to flush pending cloud prefs", error);
    });
  }, [arrangementId, identity, isSharedContext]);

  // Debounced persist when arrangementId is already present.
  const payload = useMemo(
    () => (arrangementId ? { arrangementId, tone, capo, uiPrefs: ui } : null),
    [arrangementId, tone, capo, ui],
  );
  const persistKey = payload ? JSON.stringify(payload) : "";
  const payloadRef = useRef(payload);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    const currentPayload = payloadRef.current;
    if (isSharedContext || !shouldPersistCloudPrefs(status, currentPayload, persistKey, lastPersistKeyRef) || !currentPayload) return;
    pendingPayloadRef.current = currentPayload;
    const timeout = setTimeout(
      () => persistCloudPrefs(currentPayload, persistKey, lastPersistKeyRef, pendingPayloadRef, currentSongRef.current),
      800,
    );
    return () => clearTimeout(timeout);
  }, [isSharedContext, persistKey, status]);

  // Flush on unmount so the browser can finish the request during navigation.
  useEffect(() => {
    return () => {
      if (!isSharedContext && pendingPayloadRef.current) {
        flushPendingCloudPrefs(pendingPayloadRef.current, currentSongRef.current);
      }
    };
  }, [isSharedContext]);
}

function flushPendingCloudPrefs(payload: CloudPrefsPayload, song: StoredSong | null) {
  try {
    fetch("/api/songs/prefs", {
      method: "PATCH",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, song: song ?? undefined }),
    });
  } catch {
    // swallow — best-effort on unload
  }
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
  song: StoredSong | null,
) {
  lastPersistKeyRef.current = persistKey;
  pendingPayloadRef.current = null;
  void cloudUpdateSongPrefs(payload.arrangementId, payload, song ?? undefined).catch((error) => {
    console.error("Failed to persist song prefs in cloud", error);
  });
}
