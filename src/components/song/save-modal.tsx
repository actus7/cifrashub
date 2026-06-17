"use client";

import { Bookmark, CheckCircle2, Folder, FolderPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { arrangementKey } from "@/lib/arrangement-key";
import { currentSongKey } from "@/lib/current-song-key";
import type { CurrentSongMeta, Folder as FolderType } from "@/lib/types";

type SaveModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: FolderType[];
  currentSong: CurrentSongMeta | null;
  newFolderName: string;
  onNewFolderNameChange: (v: string) => void;
  onCreateFolder: (e: React.FormEvent) => void;
  onToggleSongInFolder: (folderId: string) => void;
};

function SaveFolderButton({
  folder,
  currentArrangementKey,
  onToggleSongInFolder,
}: {
  folder: FolderType;
  currentArrangementKey: string;
  onToggleSongInFolder: (folderId: string) => void;
}) {
  const inFolder = folderHasSong(folder, currentArrangementKey);

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto justify-between gap-3 rounded-2xl px-4 py-4 text-left hover:bg-muted"
      onClick={() => onToggleSongInFolder(folder.id)}
    >
      <span className="flex items-center gap-3">
        <FolderIcon folder={folder} />
        <span className={folderTitleClassName(inFolder)}>{folder.title}</span>
      </span>
      {inFolder && <CheckCircle2 className="size-5 shrink-0 text-primary" />}
    </Button>
  );
}

function folderHasSong(folder: FolderType, currentArrangementKey: string) {
  return folder.songs.some((song) => arrangementKey(song) === currentArrangementKey);
}

function FolderIcon({ folder }: { folder: FolderType }) {
  const isDefault = folder.id === "default";
  return (
    <Folder
      className={isDefault ? "size-5 text-primary" : "size-5 text-muted-foreground"}
      fill={isDefault ? "currentColor" : "none"}
      fillOpacity={0.2}
    />
  );
}

function folderTitleClassName(inFolder: boolean) {
  return inFolder ? "font-medium text-foreground" : "font-medium text-foreground/80";
}

export function SaveModal({
  open,
  onOpenChange,
  folders,
  currentSong,
  newFolderName,
  onNewFolderNameChange,
  onCreateFolder,
  onToggleSongInFolder,
}: SaveModalProps) {
  if (!currentSong) return null;

  const currentArrangementKey = currentSongKey(currentSong);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="no-print flex max-h-[min(85vh,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-sm flex-col gap-0 overflow-hidden p-0 sm:w-full"
      >
        <DialogHeader className="sticky top-0 z-10 flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-border bg-popover p-5">
          <div className="flex flex-col gap-1 text-left">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Bookmark className="size-5 text-primary" />
              Salvar Cifra
            </DialogTitle>
            <DialogDescription className="sr-only">
              Escolha uma pasta para guardar esta cifra.
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full bg-muted"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <ScrollArea className="min-h-0 max-h-[50vh] flex-1 sm:max-h-[min(50vh,320px)]">
          <div className="flex flex-col gap-2 p-3">
            {folders.map((folder) => (
              <SaveFolderButton
                key={folder.id}
                folder={folder}
                currentArrangementKey={currentArrangementKey}
                onToggleSongInFolder={onToggleSongInFolder}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border bg-background/50 p-4">
          <form onSubmit={onCreateFolder} className="flex gap-2">
            <Input
              type="text"
              value={newFolderName}
              onChange={(e) => onNewFolderNameChange(e.target.value)}
              placeholder="Nova pasta..."
              className="flex-1 rounded-xl"
            />
            <Button
              type="submit"
              variant="secondary"
              size="icon-lg"
              disabled={!newFolderName.trim()}
              className="shrink-0 rounded-xl"
            >
              <FolderPlus className="size-5" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
