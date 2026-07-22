"use client";

import { useCallback, useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import {
  cloudFetchLibrary,
  cloudFetchSetlists,
  cloudSync,
  cloudSyncDoneKey,
  DEFAULT_FOLDERS,
  loadFolders,
  loadLocalSetlists,
  loadRecentes,
  saveLocalSetlists,
  cloudCreateSetlist,
  cloudAddSetlistItem,
  STORAGE_FOLDERS,
  STORAGE_RECENTES,
  STORAGE_SETLISTS,
} from "@/lib/storage";
import { useLibraryStore } from "@/store/use-library-store";
import type { LocalSetlistStored, Folder, StoredSong, SetlistSummary } from "@/lib/types";
import { localSetlistsToSummaries } from "@/lib/setlist-local";
import { cloudSyncSignalKey } from "@/lib/sync-signal-key";
import { subscribeToCloudRefresh } from "@/lib/cloud-refresh";

type CloudSnapshot = { folders?: Folder[]; recentes?: StoredSong[] };
type LibrarySetters = {
  setFolders: (folders: Folder[]) => void;
  setRecentes: (songs: StoredSong[]) => void;
  setLocalSetlistsRaw: (setlists: LocalSetlistStored[]) => void;
  setSetlistSummaries: (setlists: SetlistSummary[]) => void;
  setLibraryLoaded: (loaded: boolean) => void;
};
type CloudSyncContext = {
  applyCloudLibrarySnapshot: (payload: CloudSnapshot) => void;
  setFolders: (folders: Folder[]) => void;
  setRecentes: (songs: StoredSong[]) => void;
  setSetlistSummaries: (setlists: SetlistSummary[]) => void;
  userId: string;
  cancelled: () => boolean;
};

async function migrateGuestSetlist(sl: LocalSetlistStored) {
  const { setlist } = await cloudCreateSetlist(sl.title, sl.description ?? null);

  for (const item of sl.items) {
    await tryAddGuestSetlistItem(setlist.id, item);
  }
}

async function tryAddGuestSetlistItem(
  setlistId: string,
  item: LocalSetlistStored["items"][number],
) {
  try {
    await cloudAddSetlistItem(setlistId, item.arrangementId, item.notes ?? null);
  } catch {
    /* arranjo não está na biblioteca */
  }
}

async function migrateGuestSetlistsProgressive(
  guest: LocalSetlistStored[],
  save: (next: LocalSetlistStored[]) => void,
) {
  let remaining = [...guest];

  for (const sl of guest) {
    try {
      await migrateGuestSetlist(sl);
      remaining = remaining.filter((x) => x.id !== sl.id);
      save(remaining);
    } catch {
      break;
    }
  }
}

function loadLocalLibrary(setters: LibrarySetters) {
  applyLocalFolders(setters, loadFolders());
  applyLocalRecentes(setters, loadRecentes());
  applyLocalSetlists(setters, loadLocalSetlists());
  setters.setLibraryLoaded(true);
}

function applyLocalFolders(setters: Pick<LibrarySetters, "setFolders">, folders: Folder[] | null) {
  if (folders !== null) setters.setFolders(folders.length > 0 ? folders : DEFAULT_FOLDERS);
}

function applyLocalRecentes(setters: Pick<LibrarySetters, "setRecentes">, recentes: StoredSong[] | null) {
  if (recentes !== null) setters.setRecentes(recentes);
}

function applyLocalSetlists(
  setters: Pick<LibrarySetters, "setLocalSetlistsRaw" | "setSetlistSummaries">,
  setlists: LocalSetlistStored[] | null,
) {
  if (setlists === null) return;
  setters.setLocalSetlistsRaw(setlists);
  setters.setSetlistSummaries(localSetlistsToSummaries(setlists));
}

async function loadInitialCloudLibrary(isFirstSync: boolean, ctx: CloudSyncContext) {
  if (isFirstSync) {
    await syncInitialCloudLibrary(ctx);
    return;
  }

  await fetchInitialCloudLibrary(ctx);
}

async function syncInitialCloudLibrary(ctx: CloudSyncContext) {
  const merged = await cloudSync({
    folders: loadFoldersPayload(),
    recentes: loadRecentes() ?? [],
  });
  if (ctx.cancelled()) return;
  ctx.applyCloudLibrarySnapshot(merged);
  localStorage.setItem(cloudSyncDoneKey(ctx.userId), "1");
}

async function fetchInitialCloudLibrary(ctx: CloudSyncContext) {
  const library = await cloudFetchLibrary();
  if (!ctx.cancelled()) ctx.applyCloudLibrarySnapshot(library);
}

function loadFoldersPayload() {
  const folders = loadFolders();
  return folders && folders.length > 0 ? folders : DEFAULT_FOLDERS;
}

async function loadCloudSetlists(ctx: CloudSyncContext) {
  try {
    const setlists = await cloudFetchSetlists();
    if (!ctx.cancelled()) ctx.setSetlistSummaries(setlists.setlists);
  } catch (error) {
    console.error("Failed to load cloud setlists", error);
  }
}

async function performSyncOrFetch(isFirstSync: boolean, ctx: CloudSyncContext) {
  await loadInitialCloudLibrary(isFirstSync, ctx);

  const guestSetlists = loadLocalSetlists();
  if (guestSetlists?.length) {
    await migrateGuestSetlistsProgressive(guestSetlists, saveLocalSetlists);
  }

  await loadCloudSetlists(ctx);
}

function canRefreshCloud(isCloud: boolean) {
  return isCloud && (typeof window === "undefined" || navigator.onLine);
}

async function loadCloudSnapshot() {
  return Promise.allSettled([
    cloudFetchLibrary(),
    cloudFetchSetlists(),
  ]);
}

function createCloudRefreshSubscription(
  syncSignalKey: string,
  refreshCloudState: () => Promise<void>,
) {
  return subscribeToCloudRefresh(syncSignalKey, () => {
    void refreshCloudState();
  });
}

async function runInitialCloudSync(ctx: CloudSyncContext) {
  const key = cloudSyncDoneKey(ctx.userId);
  const alreadyDone = typeof window !== "undefined" && localStorage.getItem(key) === "1";

  try {
    await performSyncOrFetch(!alreadyDone, ctx);
  } catch {
    try {
      await performSyncOrFetch(false, ctx);
    } catch {
      loadLocalLibraryFallback(ctx);
    }
  }
}

function loadLocalLibraryFallback(ctx: CloudSyncContext) {
  if (ctx.cancelled()) return;
  applyLocalFolders(ctx, loadFolders());
  applyLocalRecentes(ctx, loadRecentes());
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const isCloud = status === "authenticated";
  const userId = session?.user?.id ?? null;
  const syncSignalKey = userId ? cloudSyncSignalKey(userId) : null;

  const setFolders = useLibraryStore((s) => s.setFolders);
  const setRecentes = useLibraryStore((s) => s.setRecentes);
  const setLocalSetlistsRaw = useLibraryStore((s) => s.setLocalSetlistsRaw);
  const setSetlistSummaries = useLibraryStore((s) => s.setSetlistSummaries);
  const setLibraryLoaded = useLibraryStore((s) => s.setLibraryLoaded);

  const applyCloudLibrarySnapshot = useCallback(
    (payload: CloudSnapshot) => {
      setFolders(
        payload.folders && payload.folders.length > 0 ? payload.folders : DEFAULT_FOLDERS,
      );
      setRecentes(payload.recentes ?? []);
    },
    [setFolders, setRecentes],
  );

  const refreshCloudState = useCallback(async () => {
    if (!canRefreshCloud(isCloud)) return;

    const [libraryResult, setlistsResult] = await loadCloudSnapshot();

    if (libraryResult.status === "fulfilled") {
      applyCloudLibrarySnapshot(libraryResult.value);
    }

    if (setlistsResult.status === "fulfilled") {
      setSetlistSummaries(setlistsResult.value.setlists);
    }
  }, [isCloud, applyCloudLibrarySnapshot, setSetlistSummaries]);

  useEffect(() => {
    const setters = {
      setFolders,
      setRecentes,
      setLocalSetlistsRaw,
      setSetlistSummaries,
      setLibraryLoaded,
    };

    if (status === "loading") return;

    if (status === "unauthenticated") {
      loadLocalLibrary(setters);
      return;
    }

    if (!userId) return;

    let cancelled = false;
    const ctx = {
      applyCloudLibrarySnapshot,
      cancelled: () => cancelled,
      setFolders,
      setRecentes,
      setSetlistSummaries,
      userId,
    };

    void runInitialCloudSync(ctx).finally(() => {
      if (!cancelled) setLibraryLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [status, userId, applyCloudLibrarySnapshot, setFolders, setLibraryLoaded, setLocalSetlistsRaw, setRecentes, setSetlistSummaries]);

  useEffect(() => {
    if (!isCloud || !userId || !syncSignalKey) return;
    return createCloudRefreshSubscription(syncSignalKey, refreshCloudState);
  }, [isCloud, userId, syncSignalKey, refreshCloudState]);

  useEffect(() => {
    if (status !== "unauthenticated") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_FOLDERS) applyLocalFolders({ setFolders }, loadFolders());
      if (event.key === STORAGE_RECENTES) applyLocalRecentes({ setRecentes }, loadRecentes());
      if (event.key === STORAGE_SETLISTS) {
        applyLocalSetlists({ setLocalSetlistsRaw, setSetlistSummaries }, loadLocalSetlists());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [status, setFolders, setRecentes, setLocalSetlistsRaw, setSetlistSummaries]);

  return <>{children}</>;
}
