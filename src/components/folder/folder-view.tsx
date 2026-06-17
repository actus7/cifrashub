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
import { arrangementKey } from "@/lib/arrangement-key";
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

type FolderSelectionBarProps = {
  count: number;
  onClear: () => void;
  onDelete: () => void;
};

type FolderSongsListProps = {
  songs: StoredSong[];
  selectedSongKeys: Set<string>;
  selectionMode: boolean;
  onOpenSong: (song: StoredSong) => void;
  onRemoveSongFromFolder: (song: StoredSong) => void;
  onToggleSongSelection: (song: StoredSong) => void;
  onSelectSong: (song: StoredSong) => void;
};

type DeleteFolderDialogProps = {
  folder: FolderType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteFolder: (folderId: string) => void;
};

type DeleteSongsDialogProps = {
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
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
      <FolderTopBar onBack={onBack} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 animate-in fade-in duration-300">
        <FolderTitle folder={folder} onDelete={() => setDeleteDialogOpen(true)} />

        {folderError && (
          <FolderError message={folderError} onDismiss={onDismissFolderError} />
        )}

        <FolderSearch
          query={folderSearchQuery}
          onQueryChange={onFolderSearchQueryChange}
          activeFolderSongs={folder.songs}
          folderAddPendingKey={folderAddPendingKey}
          onAddSong={onAddSongToFolder}
        />

        {selectionMode && (
          <FolderSelectionBar
            count={selectedSongKeys.size}
            onClear={clearSelection}
            onDelete={() => setDeleteSongsDialogOpen(true)}
          />
        )}

        <FolderSongsList
          songs={folder.songs}
          selectedSongKeys={selectedSongKeys}
          selectionMode={selectionMode}
          onOpenSong={onOpenSong}
          onRemoveSongFromFolder={onRemoveSongFromFolder}
          onToggleSongSelection={toggleSongSelection}
          onSelectSong={selectSong}
        />
      </main>

      <DeleteFolderDialog
        folder={folder}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleteFolder={onDeleteFolder}
      />
      <DeleteSongsDialog
        count={selectedSongKeys.size}
        open={deleteSongsDialogOpen}
        onOpenChange={setDeleteSongsDialogOpen}
        onConfirm={confirmRemoveSelectedSongs}
      />
    </div>
  );
}

function FolderTopBar({ onBack }: { onBack: () => void }) {
  return (
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
  );
}

function FolderTitle({ folder, onDelete }: { folder: FolderType; onDelete: () => void }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
      <div>
        <h2 className="flex items-center gap-3 text-3xl font-bold text-foreground">
          <Folder className="size-7 text-primary" fill="currentColor" fillOpacity={0.2} />
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
          onClick={onDelete}
        >
          <Trash2 className="size-[18px]" />
          <span className="hidden text-sm font-medium sm:inline">Apagar Pasta</span>
        </Button>
      )}
    </div>
  );
}

function FolderError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Alert variant="destructive" className="mb-4 animate-in fade-in">
      <AlertTriangle className="size-4" />
      <AlertTitle className="sr-only">Erro</AlertTitle>
      <AlertDescription className="flex flex-1 items-start gap-2 pr-8">
        <span className="flex-1 text-sm">{message}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={onDismiss}
        >
          <X className="size-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function FolderSelectionBar({ count, onClear, onDelete }: FolderSelectionBarProps) {
  return (
    <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckSquare className="size-4 text-primary" />
        {count} selecionada{count === 1 ? "" : "s"}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Cancelar
        </Button>
        <Button type="button" variant="destructive" size="sm" className="gap-2" onClick={onDelete}>
          <Trash2 className="size-4" />
          Excluir
        </Button>
      </div>
    </div>
  );
}

function FolderSongsList({
  songs,
  selectedSongKeys,
  selectionMode,
  onOpenSong,
  onRemoveSongFromFolder,
  onToggleSongSelection,
  onSelectSong,
}: FolderSongsListProps) {
  if (songs.length === 0) return <FolderEmptyState />;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {songs.map((song) => {
        const key = arrangementKey(song);
        return (
          <FolderSongCard
            key={key}
            song={song}
            selected={selectedSongKeys.has(key)}
            selectionMode={selectionMode}
            onOpen={() => onOpenSong(song)}
            onRemove={() => onRemoveSongFromFolder(song)}
            onToggleSelect={() => onToggleSongSelection(song)}
            onLongPressSelect={() => onSelectSong(song)}
          />
        );
      })}
    </div>
  );
}

function FolderEmptyState() {
  return (
    <div className="py-10 text-center text-muted-foreground">
      <Bookmark className="mx-auto mb-4 size-12 opacity-20" />
      <p>Esta pasta está vazia.</p>
      <p className="mt-2 text-sm">Use a barra acima para buscar músicas e salvá-as aqui.</p>
    </div>
  );
}

function DeleteFolderDialog({ folder, open, onOpenChange, onDeleteFolder }: DeleteFolderDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar pasta &ldquo;{folder.title}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Todas as {folder.songs.length} cifras salvas nesta pasta serão removidas. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDeleteFolder(folder.id)}>Apagar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteSongsDialog({ count, open, onOpenChange, onConfirm }: DeleteSongsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir {count} cifra{count === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            As cifras selecionadas serão removidas desta pasta. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
