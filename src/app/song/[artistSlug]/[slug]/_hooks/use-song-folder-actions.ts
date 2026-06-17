import { useCallback, useState, type FormEvent } from "react";
import { useLibraryActions } from "@/hooks/use-library-actions";
import { useSession } from "@/hooks/use-session";
import { cloudAddSongToFolder, cloudRemoveSongFromFolder, saveFolders } from "@/lib/storage";
import type { Folder, StoredSong } from "@/lib/types";
import { useLibraryStore } from "@/store/use-library-store";
import { songMatches } from "../_lib/song-match";

export function useSongFolderActions(currentSong: StoredSong | null) {
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

  const onCreateFolderFromSave = useCallback(async (e: FormEvent) => {
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
  folders: Folder[],
  currentSong: StoredSong | null,
  isSaved: boolean,
  setFolders: (folders: Folder[]) => void,
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

async function removeCloudSongFromFolder(folderId: string, folders: Folder[], currentSong: StoredSong | null) {
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

function toggleLocalSongFolder(folderId: string, folders: Folder[], currentSong: StoredSong | null, isSaved: boolean) {
  return folders.map((folder) => {
    if (folder.id !== folderId) return folder;
    if (isSaved) return { ...folder, songs: folder.songs.filter((song) => !songMatches(song, currentSong)) };
    if (currentSong) return { ...folder, songs: [...folder.songs, currentSong] };
    return folder;
  });
}
