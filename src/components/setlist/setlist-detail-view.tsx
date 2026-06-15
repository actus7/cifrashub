"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Link2,
  ListMusic,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { flattenLibrarySongs } from "@/lib/library-flat";
import { arrangementKey } from "@/lib/stored-song-key";
import type {
  Folder,
  SetlistDetailView,
  SetlistItemView,
  StoredSong,
} from "@/lib/types";

type SetlistDetailViewProps = {
  detail: SetlistDetailView;
  folders: Folder[];
  recentes: StoredSong[];
  onBack: () => void;
  onOpenSong: (song: StoredSong) => void;
  onAddItem: (arrangementId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onShare?: () => void;
  shareBusy?: boolean;
  disabled?: boolean;
};

type SetlistHeaderProps = {
  onBack: () => void;
  onShare?: () => void;
  shareBusy?: boolean;
  disabled?: boolean;
};

type AddSongSelectProps = {
  addable: StoredSong[];
  disabled?: boolean;
  onAddItem: (arrangementId: string) => void;
};

type SetlistItemsProps = {
  items: SetlistItemView[];
  disabled?: boolean;
  onOpenSong: (song: StoredSong) => void;
  onRemoveItem: (itemId: string) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
};

type SetlistItemRowProps = {
  item: SetlistItemView;
  index: number;
  total: number;
  disabled?: boolean;
  onOpenSong: (song: StoredSong) => void;
  onRemoveItem: (itemId: string) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
};

export function SetlistDetailViewScreen({
  detail,
  folders,
  recentes,
  onBack,
  onOpenSong,
  onAddItem,
  onRemoveItem,
  onMoveItem,
  onShare,
  shareBusy,
  disabled,
}: SetlistDetailViewProps) {
  const library = flattenLibrarySongs(folders, recentes);
  const inSet = new Set(detail.items.map((i) => i.arrangementId));
  const addable = library.filter((s) => !inSet.has(arrangementKey(s)));
  const sortedItems = [...detail.items].sort((a, b) => a.position - b.position);

  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/30">
      <SetlistHeader
        onBack={onBack}
        onShare={onShare}
        shareBusy={shareBusy}
        disabled={disabled}
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-6">
        <SetlistHero detail={detail} />
        <AddSongSelect addable={addable} disabled={disabled} onAddItem={onAddItem} />
        <SetlistItems
          items={sortedItems}
          disabled={disabled}
          onOpenSong={onOpenSong}
          onRemoveItem={onRemoveItem}
          onMoveItem={onMoveItem}
        />
      </main>
    </div>
  );
}

function SetlistHeader({ onBack, onShare, shareBusy, disabled }: SetlistHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border/60 p-4">
      <Button
        type="button"
        variant="ghost"
        className="gap-2 text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="size-5" />
        Voltar
      </Button>
      {onShare ? (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={disabled || shareBusy}
            onClick={onShare}
          >
            <Link2 className="size-4" />
            {shareBusy ? "…" : "Link"}
          </Button>
        </div>
      ) : (
        <div className="size-8" />
      )}
    </header>
  );
}

function SetlistHero({ detail }: { detail: SetlistDetailView }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
        <ListMusic className="size-6 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-foreground">{detail.title}</h1>
        {detail.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{detail.description}</p>
        ) : null}
      </div>
    </div>
  );
}

function AddSongSelect({ addable, disabled, onAddItem }: AddSongSelectProps) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Adicionar da biblioteca
      </label>
      <select
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
        defaultValue=""
        disabled={disabled || addable.length === 0}
        onChange={(e) => {
          const v = e.target.value;
          if (v) {
            onAddItem(v);
            e.target.value = "";
          }
        }}
      >
        <option value="">
          {addable.length === 0 ? "Todas já estão na setlist" : "Escolher música…"}
        </option>
        {addable.map((song) => (
          <option key={arrangementKey(song)} value={arrangementKey(song)}>
            {song.title} — {song.artist}
          </option>
        ))}
      </select>
    </div>
  );
}

function SetlistItems({ items, disabled, onOpenSong, onRemoveItem, onMoveItem }: SetlistItemsProps) {
  if (items.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Nenhuma música. Adicione da sua biblioteca.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <SetlistItemRow
          key={item.itemId}
          item={item}
          index={index}
          total={items.length}
          disabled={disabled}
          onOpenSong={onOpenSong}
          onRemoveItem={onRemoveItem}
          onMoveItem={onMoveItem}
        />
      ))}
    </ul>
  );
}

function SetlistItemRow({
  item,
  index,
  total,
  disabled,
  onOpenSong,
  onRemoveItem,
  onMoveItem,
}: SetlistItemRowProps) {
  return (
    <li className="flex items-stretch gap-1 rounded-xl border border-border/60 bg-card/50 p-2">
      <div className="flex flex-col justify-center gap-0.5 border-r border-border/50 pr-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={disabled || index === 0}
          onClick={() => onMoveItem(item.itemId, -1)}
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={disabled || index === total - 1}
          onClick={() => onMoveItem(item.itemId, 1)}
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>
      <button
        type="button"
        className="min-w-0 flex-1 px-2 text-left"
        disabled={!item.song}
        onClick={() => item.song && onOpenSong(item.song)}
      >
        <p className="truncate font-medium text-foreground">
          {item.song?.title ?? "(música removida da biblioteca)"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {item.song?.artist ?? item.arrangementId}
        </p>
        {item.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p> : null}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        disabled={disabled}
        onClick={() => onRemoveItem(item.itemId)}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
