"use client";

import { useParams, useRouter } from "next/navigation";
import { FolderView } from "@/components/folder/folder-view";
import { useLibraryStore } from "@/store/use-library-store";
import { useLibraryActions } from "@/hooks/use-library-actions";
import { useState } from "react";
import { fetchChordsHtml } from "@/lib/fetch-proxy";
import { processHtmlAndExtract } from "@/lib/parser";
import { enrichStoredSongWithYoutube } from "@/hooks/use-song-loader";
import { cloudAddSongToFolder, cloudRemoveSongFromFolder, saveFolders } from "@/lib/storage";
import { arrangementKey } from "@/lib/arrangement-key";
import { useSession } from "@/hooks/use-session";
import type { Folder, SearchResultSong, StoredSong } from "@/lib/types";

async function removeCloudFolderSongs(
  folderId: string,
  keys: Set<string>,
  folders: Folder[],
) {
  let nextFolders = folders;
  for (const key of keys) {
    try {
      const { folders: next } = await cloudRemoveSongFromFolder(folderId, key);
      nextFolders = next;
    } catch (error) {
      console.error(`Failed to remove song ${key} from cloud:`, error);
    }
  }
  return nextFolders;
}

function removeLocalFolderSongs(
  folders: Folder[],
  folderId: string,
  keys: Set<string>,
) {
  return folders.map((f) => {
    if (f.id !== folderId) return f;
    return {
      ...f,
      songs: f.songs.filter((s) => !keys.has(arrangementKey(s))),
    };
  });
}

async function songFromSearchResult(res: SearchResultSong, songId: string) {
  const html = await fetchChordsHtml(res.artistSlug, res.slug);
  const song = processHtmlAndExtract(
    html,
    songId,
    res.title,
    res.artistName,
    res.artistSlug,
    res.slug,
  );
  return enrichStoredSongWithYoutube(song);
}

function addLocalSongToFolder(folders: Folder[], folderId: string, song: StoredSong) {
  const songKey = arrangementKey(song);
  return folders.map((f) => {
    if (f.id !== folderId || f.songs.some((s) => arrangementKey(s) === songKey)) return f;
    return { ...f, songs: [song, ...f.songs] };
  });
}

type AddFolderSongArgs = {
  folderId: string;
  folders: Folder[];
  isCloud: boolean;
  notifyCloudMutation: () => void;
  setFolders: (folders: Folder[]) => void;
  song: StoredSong;
};

async function applyAddedFolderSong({
  folderId,
  folders,
  isCloud,
  notifyCloudMutation,
  setFolders,
  song,
}: AddFolderSongArgs) {
  if (isCloud) {
    const { folders: next } = await cloudAddSongToFolder(folderId, song);
    setFolders(next);
    notifyCloudMutation();
    return;
  }

  const next = addLocalSongToFolder(folders, folderId, song);
  saveFolders(next);
  setFolders(next);
}

export default function FolderPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { status } = useSession();
  const isCloud = status === "authenticated";

  const folders = useLibraryStore((s) => s.folders);
  const setFolders = useLibraryStore((s) => s.setFolders);
  const folder = folders.find((f) => f.id === folderId);

  const { notifyCloudMutation, handleDeleteFolder } = useLibraryActions();

  const [folderSearchQuery, setFolderSearchQuery] = useState("");
  const [folderAddPendingKey, setFolderAddPendingKey] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);

  if (!folder) {
    return <div className="p-8 text-center text-muted-foreground">Pasta não encontrada.</div>;
  }

  const handleAddSongToFolder = async (res: SearchResultSong) => {
    if (!folderId) return;
    const songId = `${res.artistSlug}-${res.slug}`;
    setFolderAddPendingKey(songId);
    setFolderError(null);
    try {
      const song = await songFromSearchResult(res, songId);
      await applyAddedFolderSong({
        folderId,
        folders,
        isCloud,
        notifyCloudMutation,
        setFolders,
        song,
      });
      setFolderSearchQuery("");
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Problema de rede ao importar cifra.");
    } finally {
      setFolderAddPendingKey(null);
    }
  };

  const onRemoveSongsFromFolder = async (songs: StoredSong[]) => {
    if (!folderId || songs.length === 0) return;
    const keys = new Set(songs.map((song) => arrangementKey(song)));
    if (isCloud) {
      const nextFolders = await removeCloudFolderSongs(folderId, keys, folders);
      setFolders(nextFolders);
      notifyCloudMutation();
    } else {
      const nextFolders = removeLocalFolderSongs(folders, folderId, keys);
      saveFolders(nextFolders);
      setFolders(nextFolders);
    }
  };

  const onRemoveSongFromFolder = async (song: StoredSong) => {
    await onRemoveSongsFromFolder([song]);
  };

  const onOpenSong = (song: StoredSong) => {
    if (!folderId) return;
    const params = new URLSearchParams();
    params.set("folderId", folderId);
    params.set("arrangementId", arrangementKey(song));
    router.push(`/song/${song.artistSlug}/${song.slug}?${params.toString()}`);
  };

  const doDelete = async (id: string) => {
    await handleDeleteFolder(id);
    router.push("/");
  };

  return (
    <FolderView
      folder={folder}
      folderSearchQuery={folderSearchQuery}
      onFolderSearchQueryChange={setFolderSearchQuery}
      folderAddPendingKey={folderAddPendingKey}
      folderError={folderError}
      onDismissFolderError={() => setFolderError(null)}
      onAddSongToFolder={handleAddSongToFolder}
      onBack={() => router.push("/")}
      onDeleteFolder={doDelete}
      onOpenSong={onOpenSong}
      onRemoveSongFromFolder={onRemoveSongFromFolder}
      onRemoveSongsFromFolder={onRemoveSongsFromFolder}
    />
  );
}
