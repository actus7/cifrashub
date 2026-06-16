"use client";

import { memo } from "react";
import { Clock, Music, Trash2 } from "lucide-react";
import { songIdentityKey } from "@/lib/stored-song-key";
import type { StoredSong } from "@/lib/types";

type RecentListProps = {
  recentes: StoredSong[];
  onSelect: (song: StoredSong) => void;
  onRemove: (song: StoredSong) => void;
  onClearAll: () => void;
};

export const RecentList = memo(function RecentList({
  recentes,
  onSelect,
  onRemove,
  onClearAll,
}: RecentListProps) {
  if (recentes.length === 0) {
    return (
      <section className="flex flex-col gap-5">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
          <Clock className="size-3.5 shrink-0" />
          Tocadas Recentemente
        </h3>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 bg-card/20 px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/50">
            <Music className="size-5 text-muted-foreground/60" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground/70">
              Nenhuma música tocada ainda
            </p>
            <p className="text-xs text-muted-foreground">
              Pesquise uma cifra acima para começar
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
          <Clock className="size-3.5 shrink-0" />
          Tocadas Recentemente
        </h3>
        <button
          type="button"
          onClick={onClearAll}
          className="shrink-0 text-[11px] font-medium text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/40"
        >
          Limpar tudo
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {recentes.map((song) => (
          <div
            key={songIdentityKey(song)}
            className="group/item flex w-full items-center gap-1 rounded-xl pr-1 pl-1 transition-colors hover:bg-card/80"
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(song);
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition-[opacity,colors] hover:bg-destructive/15 hover:text-destructive sm:opacity-0 sm:group-hover/item:opacity-100"
              aria-label={`Remover “${song.title}” dos recentes`}
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSelect(song)}
              className="flex min-w-0 flex-1 items-center gap-3.5 rounded-lg py-2.5 pr-3 text-left transition-colors"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card/60 ring-1 ring-border/50 transition-colors group-hover/item:ring-border">
                <Music className="size-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground/90 transition-colors group-hover/item:text-foreground">
                  {song.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {song.artist}
                </p>
              </div>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
});
