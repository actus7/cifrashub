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
} from "@/lib/storage";
import { useLibraryStore } from "@/store/use-library-store";
import type { LocalSetlistStored, Folder, StoredSong, SetlistSummary } from "@/lib/types";
import { localSetlistsToSummaries } from "@/lib/setlist-local";
import { cloudSyncSignalKey } from "@/lib/sync-signal-key";

const CLOUD_SYNC_POLL_MS = 15_000;

type SyncStatus = "loading" | "authenticated" | "unauthenticated";
type CloudSnapshot = { folders?: Folder[]; recentes?: StoredSong[] };
type LibrarySetters = {
  setFolders: (folders: Folder[]) => void;
  setRecentes: (songs: StoredSong[]) => void;
  setLocalSetlistsRaw: (setlists: LocalSetlistStored[]) => void;
  setSetlistSummaries: (setlists: SetlistSummary[]) => void;
  setLibraryLoaded: (loaded: boolean) => void;
};
type SyncEffectOptions = LibrarySetters & {
  applyCloudLibrarySnapshot: (payload: CloudSnapshot) => void;
  status: SyncStatus;
  userId: string | null;
};

type CloudSyncContext = Pick<SyncEffectOptions, "applyCloudLibrarySnapshot" | "setFolders" | "setRecentes" | "setSetlistSummaries" | "userId"> & {
  cancelled: () => boolean;
};

async function migrateGuestSetlist(sl: LocalSetlistStored) {
  const { setlist } = await cloudCreateSetlist(sl.title, sl.description ?? null);

  for (const item of sl.items) {
    try {
      await cloudAddSetlistItem(setlist.id, item.arrangementId, item.notes ?? null);
    } catch {
      /* arranjo não está na biblioteca */
    }
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
  const folders = loadFolders();
  const recentes = loadRecentes();
  const setlists = loadLocalSetlists();

  if (folders !== null) setters.setFolders(folders.length > 0 ? folders : DEFAULT_FOLDERS);
  if (recentes !== null) setters.setRecentes(recentes);
  if (setlists !== null) {
    setters.setLocalSetlistsRaw(setlists);
    setters.setSetlistSummaries(localSetlistsToSummaries(setlists));
  }

  setters.setLibraryLoaded(true);
}

async function loadInitialCloudLibrary(isFirstSync: boolean, ctx: CloudSyncContext) {
  if (isFirstSync) {
    const merged = await cloudSync({
      folders: loadFoldersPayload(),
      recentes: loadRecentes() ?? [],
    });
    if (ctx.cancelled()) return;
    ctx.applyCloudLibrarySnapshot(merged);
    localStorage.setItem(cloudSyncDoneKey(ctx.userId!), "1");
    return;
  }

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
  } catch {
    if (!ctx.cancelled()) ctx.setSetlistSummaries([]);
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

async function runInitialCloudSync(ctx: CloudSyncContext) {
  const key = cloudSyncDoneKey(ctx.userId!);
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
  const folders = loadFolders();
  const recentes = loadRecentes();

  if (ctx.cancelled()) return;
  if (folders !== null) ctx.setFolders(folders.length > 0 ? folders : DEFAULT_FOLDERS);
  if (recentes !== null) ctx.setRecentes(recentes);
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
    if (!isCloud) return;
    if (typeof window !== "undefined" && !navigator.onLine) return;

    const [libraryResult, setlistsResult] = await Promise.allSettled([
      cloudFetchLibrary(),
      cloudFetchSetlists(),
    ]);

    if (libraryResult.status === "fulfilled") {
      applyCloudLibrarySnapshot(libraryResult.value);
    }

    if (setlistsResult.status === "fulfilled") {
      setSetlistSummaries(setlistsResult.value.setlists);
    }
  }, [isCloud, applyCloudLibrarySnapshot, setSetlistSummaries]);

  /** Carrega localStorage ou nuvem/sync na primeira vez */
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

    const runRefresh = () => {
      void refreshCloudState();
    };

    let intervalId: number | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = window.setInterval(runRefresh, CLOUD_SYNC_POLL_MS);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        runRefresh();
        startPolling();
      } else {
        stopPolling();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== syncSignalKey || !event.newValue) return;
      runRefresh();
    };

    if (document.visibilityState === "visible") {
      startPolling();
    }

    window.addEventListener("focus", runRefresh);
    window.addEventListener("online", runRefresh);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      window.removeEventListener("focus", runRefresh);
      window.removeEventListener("online", runRefresh);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isCloud, userId, syncSignalKey, refreshCloudState]);

  return <>{children}</>;
}
