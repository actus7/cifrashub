"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  CheckSquare,
  ChevronLeft,
  Folder,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FolderSearch } from "./folder-search";
import { FolderSongCard } from "./folder-song-card";
import { arrangementKey } from "@/lib/stored-song-key";
import type { Folder as FolderType, SearchResultSong, StoredSong } from "@/lib/types";

type FolderViewProps = {
  folder: FolderType;
  folderSearchQuery: string;
  onFolderSearchQueryChange: (q: string) => void;
  folderAddPendingKey: string | null;
  folderError: string | null;
  onDismissFolderError: () => void;
  onAddSongToFolder: (res: SearchResultSong) => void;
  onBack: () => void;
  onDeleteFolder: (folderId: string) => void;
  onOpenSong: (song: StoredSong) => void;
  onRemoveSongFromFolder: (song: StoredSong) => void;
  onRemoveSongsFromFolder: (songs: StoredSong[]) => Promise<void> | void;
};

export function FolderView({
  folder,
  folderSearchQuery,
  onFolderSearchQueryChange,
  folderAddPendingKey,
  folderError,
  onDismissFolderError,
  onAddSongToFolder,
  onBack,
  onDeleteFolder,
  onOpenSong,
  onRemoveSongFromFolder,
  onRemoveSongsFromFolder,
}: FolderViewProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSongsDialogOpen, setDeleteSongsDialogOpen] = useState(false);
  const [selectedSongKeys, setSelectedSongKeys] = useState<Set<string>>(new Set());

  const selectedSongs = folder.songs.filter((song) => selectedSongKeys.has(arrangementKey(song)));
  const selectionMode = selectedSongKeys.size > 0;

  const clearSelection = () => setSelectedSongKeys(new Set());
  const toggleSongSelection = (song: StoredSong) => {
    const key = arrangementKey(song);
    setSelectedSongKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  const selectSong = (song: StoredSong) => {
    const key = arrangementKey(song);
    setSelectedSongKeys((current) => new Set(current).add(key));
  };
  const confirmRemoveSelectedSongs = async () => {
    await onRemoveSongsFromFolder(selectedSongs);
    clearSelection();
    setDeleteSongsDialogOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col selection:bg-primary/30">
      <header className="relative z-10 flex items-center justify-between p-4">
        <Button
          type="button"
          variant="ghost"
          className="gap-2 text-muted-foreground"
          onClick={onBack}
        >
          <ChevronLeft className="size-6" />
          <span className="font-bold">Início</span>
        </Button>
        <div className="size-8" />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 animate-in fade-in duration-300">
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="flex items-center gap-3 text-3xl font-bold text-foreground">
              <Folder
                className="size-7 text-primary"
                fill="currentColor"
                fillOpacity={0.2}
              />
              {folder.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {folder.songs.length} músicas salvas offline
            </p>
          </div>
          {!folder.isDefault && folder.id !== "default" && (
            <Button
              type="button"
              variant="ghost"
              className="gap-2 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-[18px]" />
              <span className="hidden text-sm font-medium sm:inline">
                Apagar Pasta
              </span>
            </Button>
          )}
        </div>

        {folderError && (
          <Alert variant="destructive" className="mb-4 animate-in fade-in">
            <AlertTriangle className="size-4" />
            <AlertTitle className="sr-only">Erro</AlertTitle>
            <AlertDescription className="flex flex-1 items-start gap-2 pr-8">
              <span className="flex-1 text-sm">{folderError}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={onDismissFolderError}
              >
                <X className="size-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <FolderSearch
          query={folderSearchQuery}
          onQueryChange={onFolderSearchQueryChange}
          activeFolderSongs={folder.songs}
          folderAddPendingKey={folderAddPendingKey}
          onAddSong={onAddSongToFolder}
        />

        {selectionMode && (
          <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckSquare className="size-4 text-primary" />
              {selectedSongKeys.size} selecionada{selectedSongKeys.size === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => setDeleteSongsDialogOpen(true)}
              >
                <Trash2 className="size-4" />
                Excluir
              </Button>
            </div>
          </div>
        )}

        {folder.songs.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <Bookmark className="mx-auto mb-4 size-12 opacity-20" />
            <p>Esta pasta está vazia.</p>
            <p className="mt-2 text-sm">
              Use a barra acima para buscar músicas e salvá-as aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {folder.songs.map((song) => (
              <FolderSongCard
                key={arrangementKey(song)}
                song={song}
                selected={selectedSongKeys.has(arrangementKey(song))}
                selectionMode={selectionMode}
                onOpen={() => onOpenSong(song)}
                onRemove={() => onRemoveSongFromFolder(song)}
                onToggleSelect={() => toggleSongSelection(song)}
                onLongPressSelect={() => selectSong(song)}
              />
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar pasta &ldquo;{folder.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as {folder.songs.length} cifras salvas nesta pasta serão
              removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDeleteFolder(folder.id)}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSongsDialogOpen} onOpenChange={setDeleteSongsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedSongKeys.size} cifra{selectedSongKeys.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              As cifras selecionadas serão removidas desta pasta. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveSelectedSongs}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
