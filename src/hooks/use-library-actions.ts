import { useCallback } from "react";
import { useLibraryStore } from "@/store/use-library-store";
import { useSession } from "@/hooks/use-session";
import {
  cloudCreateFolder,
  cloudDeleteFolder,
  cloudSaveRecentes,
  cloudClearRecentes,
  saveFolders,
  saveRecentes,
} from "@/lib/storage";
import { songIdentityKey } from "@/lib/song-identity-key";
import type { Folder, StoredSong } from "@/lib/types";
import { cloudSyncSignalKey } from "@/lib/sync-signal-key";

function isDefaultFolder(folders: Folder[], folderId: string) {
  return folderId === "default" || folders.some((folder) => folder.id === folderId && folder.isDefault);
}

type CloudState = {
  isCloud: boolean;
  notifyCloudMutation: () => void;
};

function useCloudState(): CloudState {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const syncSignalKey = userId ? cloudSyncSignalKey(userId) : null;

  const notifyCloudMutation = useCallback(() => {
    if (!syncSignalKey || typeof window === "undefined") return;
    try {
      localStorage.setItem(syncSignalKey, `${Date.now()}`);
    } catch {
    }
  }, [syncSignalKey]);

  return { isCloud: status === "authenticated", notifyCloudMutation };
}

function useFolderActions({ isCloud, notifyCloudMutation }: CloudState) {
  const folders = useLibraryStore((s) => s.folders);
  const setFolders = useLibraryStore((s) => s.setFolders);

  const doCreateFolder = useCallback(
    async (newFolderName: string) => {
      const title = newFolderName.trim();
      if (!title) return;
      if (isCloud) {
        await createCloudFolder(title, setFolders, notifyCloudMutation);
        return;
      }
      createLocalFolder(title, folders, setFolders);
    },
    [folders, isCloud, notifyCloudMutation, setFolders],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      if (isDefaultFolder(folders, folderId)) return;
      if (isCloud) {
        await deleteCloudFolder(folderId, setFolders, notifyCloudMutation);
        return;
      }
      deleteLocalFolder(folderId, folders, setFolders);
    },
    [folders, isCloud, notifyCloudMutation, setFolders],
  );

  return { doCreateFolder, handleDeleteFolder };
}

async function createCloudFolder(
  title: string,
  setFolders: (folders: Folder[]) => void,
  notifyCloudMutation: () => void,
) {
  try {
    const { folders: next } = await cloudCreateFolder(title);
    setFolders(next);
    notifyCloudMutation();
  } catch (error) {
    console.error("Failed to create folder in cloud", error);
  }
}

function createLocalFolder(title: string, folders: Folder[], setFolders: (folders: Folder[]) => void) {
  const next = [...folders, { id: newFolderId(), title, songs: [] }];
  saveFolders(next);
  setFolders(next);
}

function newFolderId() {
  return typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2, 15);
}

async function deleteCloudFolder(
  folderId: string,
  setFolders: (folders: Folder[]) => void,
  notifyCloudMutation: () => void,
) {
  try {
    const { folders: next } = await cloudDeleteFolder(folderId);
    setFolders(next);
    notifyCloudMutation();
  } catch (error) {
    console.error("Failed to delete folder in cloud", error);
  }
}

function deleteLocalFolder(folderId: string, folders: Folder[], setFolders: (folders: Folder[]) => void) {
  const next = folders.filter((folder) => folder.id !== folderId);
  saveFolders(next);
  setFolders(next);
}

function useRecentActions({ isCloud, notifyCloudMutation }: CloudState) {
  const recentes = useLibraryStore((s) => s.recentes);
  const setRecentes = useLibraryStore((s) => s.setRecentes);

  const syncRecentes = useCallback(
    (next: StoredSong[], errorMessage: string) => {
      if (isCloud) {
        syncCloudRecentes(next, recentes, setRecentes, notifyCloudMutation, errorMessage);
        return;
      }
      saveRecentes(next);
      setRecentes(next);
    },
    [isCloud, notifyCloudMutation, recentes, setRecentes],
  );

  const clearAllRecentes = useCallback(() => {
    syncRecentes([], "Failed to clear recentes in cloud");
  }, [syncRecentes]);

  const removeFromRecentes = useCallback(
    (song: StoredSong) => {
      const k = songIdentityKey(song);
      syncRecentes(recentes.filter((s) => songIdentityKey(s) !== k), "Failed to remove from recentes in cloud");
    },
    [recentes, syncRecentes],
  );

  const addToRecentes = useCallback(
    (songObj: StoredSong) => {
      const k = songIdentityKey(songObj);
      syncRecentes([songObj, ...recentes.filter((s) => songIdentityKey(s) !== k)].slice(0, 15), "Failed to add to recentes in cloud");
    },
    [recentes, syncRecentes],
  );

  return { clearAllRecentes, removeFromRecentes, addToRecentes };
}

function syncCloudRecentes(
  next: StoredSong[],
  previous: StoredSong[],
  setRecentes: (songs: StoredSong[]) => void,
  notifyCloudMutation: () => void,
  errorMessage: string,
) {
  setRecentes(next);
  void (next.length === 0 ? cloudClearRecentes() : cloudSaveRecentes(next))
    .then(({ recentes: synced }) => {
      setRecentes(synced);
      notifyCloudMutation();
    })
    .catch((error) => {
      console.error(errorMessage, error);
      setRecentes(previous);
    });
}

export function useLibraryActions() {
  const cloudState = useCloudState();
  return {
    ...useFolderActions(cloudState),
    ...useRecentActions(cloudState),
    notifyCloudMutation: cloudState.notifyCloudMutation,
  };
}
