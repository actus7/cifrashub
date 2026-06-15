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
import { arrangementKey } from "@/lib/stored-song-key";
import type { Folder, StoredSong } from "@/lib/types";
import { cloudSyncSignalKey } from "@/lib/sync-signal-key";

export function useLibraryActions() {
  const { data: session, status } = useSession();
  const isCloud = status === "authenticated";
  const userId = session?.user?.id ?? null;
  const syncSignalKey = userId ? cloudSyncSignalKey(userId) : null;

  const folders = useLibraryStore((s) => s.folders);
  const setFolders = useLibraryStore((s) => s.setFolders);
  const recentes = useLibraryStore((s) => s.recentes);
  const setRecentes = useLibraryStore((s) => s.setRecentes);

  const notifyCloudMutation = useCallback(() => {
    if (!syncSignalKey || typeof window === "undefined") return;
    try {
      localStorage.setItem(syncSignalKey, `${Date.now()}`);
    } catch {
      /* noop */
    }
  }, [syncSignalKey]);

  const doCreateFolder = useCallback(
    async (newFolderName: string) => {
      if (!newFolderName.trim()) return;
      if (isCloud) {
        try {
          const { folders: next } = await cloudCreateFolder(newFolderName.trim());
          setFolders(next);
          notifyCloudMutation();
        } catch (error) {
          console.error("Failed to create folder in cloud", error);
        }
      } else {
        const newFolder: Folder = {
          id: Date.now().toString(),
          title: newFolderName.trim(),
          songs: [],
        };
        const next = [...folders, newFolder];
        saveFolders(next);
        setFolders(next);
      }
    },
    [folders, isCloud, notifyCloudMutation, setFolders],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      const meta = folders.find((f) => f.id === folderId);
      if (meta?.isDefault || folderId === "default") return;

      if (isCloud) {
        try {
          const { folders: next } = await cloudDeleteFolder(folderId);
          setFolders(next);
          notifyCloudMutation();
        } catch (error) {
          console.error("Failed to delete folder in cloud", error);
        }
      } else {
        const next = folders.filter((f) => f.id !== folderId);
        saveFolders(next);
        setFolders(next);
      }
    },
    [folders, isCloud, notifyCloudMutation, setFolders],
  );

  const syncRecentes = useCallback(
    (next: StoredSong[], errorMessage: string) => {
      if (isCloud) {
        void cloudSaveRecentes(next)
          .then(({ recentes: synced }) => {
            setRecentes(synced);
            notifyCloudMutation();
          })
          .catch((error) => {
            console.error(errorMessage, error);
            saveRecentes(next);
          });
      } else {
        saveRecentes(next);
      }
      setRecentes(next);
    },
    [isCloud, notifyCloudMutation, setRecentes],
  );

  const clearAllRecentes = useCallback(() => {
    setRecentes([]);
    if (isCloud) {
      void cloudClearRecentes()
        .then(({ recentes: synced }) => {
          setRecentes(synced);
          notifyCloudMutation();
        })
        .catch((error) => {
          console.error("Failed to clear recentes in cloud", error);
          saveRecentes([]);
        });
    } else {
      saveRecentes([]);
    }
  }, [isCloud, notifyCloudMutation, setRecentes]);

  const removeFromRecentes = useCallback(
    (song: StoredSong) => {
      const ak = arrangementKey(song);
      const next = recentes.filter((s) => arrangementKey(s) !== ak);
      syncRecentes(next, "Failed to remove from recentes in cloud");
    },
    [recentes, syncRecentes],
  );

  const addToRecentes = useCallback(
    (songObj: StoredSong) => {
      const k = arrangementKey(songObj);
      const next = [
        songObj,
        ...recentes.filter((s) => arrangementKey(s) !== k),
      ].slice(0, 15);
      syncRecentes(next, "Failed to add to recentes in cloud");
    },
    [recentes, syncRecentes],
  );

  return {
    doCreateFolder,
    handleDeleteFolder,
    clearAllRecentes,
    removeFromRecentes,
    addToRecentes,
    notifyCloudMutation,
  };
}
