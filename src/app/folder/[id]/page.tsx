"use client";

import { useParams, useRouter } from "next/navigation";
import { FolderView } from "@/components/folder/folder-view";
import { useLibraryStore } from "@/store/use-library-store";
import { useLibraryActions } from "@/hooks/use-library-actions";
import { useState } from "react";
import { fetchChordsHtml } from "@/lib/fetch-proxy";
import { processHtmlAndExtract } from "@/lib/parser";
import { enrichStoredSongWithYoutube } from "@/hooks/use-song-loader";
import { cloudAddSongToFolder, cloudRemoveSongFromFolder } from "@/lib/storage";
import { arrangementKey } from "@/lib/stored-song-key";
import { useSession } from "@/hooks/use-session";
import type { SearchResultSong, StoredSong } from "@/lib/types";

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
      const html = await fetchChordsHtml(res.artistSlug, res.slug);
      let newSong = processHtmlAndExtract(
        html,
        songId,
        res.title,
        res.artistName,
        res.artistSlug,
        res.slug,
      );
      newSong = await enrichStoredSongWithYoutube(newSong);

      if (isCloud) {
        const { folders: next } = await cloudAddSongToFolder(folderId, newSong);
        setFolders(next);
        notifyCloudMutation();
      } else {
        const updated = folders.map((f) => {
          if (f.id === folderId && !f.songs.some((s) => arrangementKey(s) === arrangementKey(newSong))) {
            return { ...f, songs: [newSong, ...f.songs] };
          }
          return f;
        });
        setFolders(updated);
        // We should also save locally but the effect in SyncProvider handles it or we call hook action
      }
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
      let nextFolders = folders;
      for (const key of keys) {
        try {
          const { folders: next } = await cloudRemoveSongFromFolder(folderId, key);
          nextFolders = next;
        } catch (error) {
          console.error(`Failed to remove song ${key} from cloud:`, error);
        }
      }
      setFolders(nextFolders);
      notifyCloudMutation();
    } else {
      const updated = folders.map((f) => {
        if (f.id !== folderId) return f;
        return {
          ...f,
          songs: f.songs.filter((s) => !keys.has(arrangementKey(s))),
        };
      });
      setFolders(updated);
    }
  };

  const onRemoveSongFromFolder = async (song: StoredSong) => {
    await onRemoveSongsFromFolder([song]);
  };

  const onOpenSong = (song: StoredSong) => {
    router.push(`/song/${song.artistSlug}/${song.slug}?folderId=${folderId}`);
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
