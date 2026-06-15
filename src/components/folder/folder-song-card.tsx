"use client";

import { useEffect, useRef } from "react";
import { Check, Music, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StoredSong } from "@/lib/types";

type FolderSongCardProps = {
  song: StoredSong;
  selected: boolean;
  selectionMode: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onToggleSelect: () => void;
  onLongPressSelect: () => void;
};

function useLongPress(onLongPressSelect: () => void) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current === null) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  useEffect(() => clearLongPressTimer, []);

  const startLongPressTimer = () => {
    longPressTriggeredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPressSelect();
    }, 450);
  };

  const consumeLongPress = () => {
    if (!longPressTriggeredRef.current) return false;
    longPressTriggeredRef.current = false;
    return true;
  };

  return { clearLongPressTimer, consumeLongPress, startLongPressTimer };
}

function FolderSongIcon({ selected }: { selected: boolean }) {
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground",
        selected && "bg-primary text-primary-foreground",
      )}
    >
      {selected ? <Check className="size-5" /> : <Music className="size-5" />}
    </div>
  );
}

function RemoveSongButton({ onRemove }: { onRemove: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="absolute top-1/2 right-4 z-10 size-8 -translate-y-1/2 rounded-full bg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

export function FolderSongCard({
  song,
  selected,
  selectionMode,
  onOpen,
  onRemove,
  onToggleSelect,
  onLongPressSelect,
}: FolderSongCardProps) {
  const { clearLongPressTimer, consumeLongPress, startLongPressTimer } = useLongPress(onLongPressSelect);

  const handleClick = () => {
    if (consumeLongPress()) return;
    if (selectionMode) {
      onToggleSelect();
      return;
    }
    onOpen();
  };

  return (
    <div className="group relative">
      <button
        type="button"
        aria-pressed={selectionMode ? selected : undefined}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
        onPointerCancel={clearLongPressTimer}
        onPointerDown={startLongPressTimer}
        onPointerLeave={clearLongPressTimer}
        onPointerUp={clearLongPressTimer}
        className="w-full touch-manipulation select-none text-left"
      >
        <Card
          className={cn(
            "flex w-full items-center gap-4 border-border bg-card p-4 transition-colors hover:border-muted-foreground",
            selected && "border-primary bg-primary/10 ring-2 ring-primary/30",
          )}
        >
          <FolderSongIcon selected={selected} />
          <div className="min-w-0 flex-1 pr-10">
            <h3 className="truncate text-base font-bold text-foreground">
              {song.title}
            </h3>
            <p className="truncate text-sm text-muted-foreground">
              {song.artist}
            </p>
          </div>
        </Card>
      </button>
      {!selectionMode && <RemoveSongButton onRemove={onRemove} />}
    </div>
  );
}
