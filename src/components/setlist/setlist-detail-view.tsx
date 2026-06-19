"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Link2,
  ListMusic,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { flattenLibrarySongs } from "@/lib/library-flat";
import { arrangementKey } from "@/lib/arrangement-key";
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
  onAddItem: (arrangementId: string) => Promise<void> | void;
  onRemoveItem: (itemId: string) => Promise<void> | void;
  onMoveItem: (itemId: string, direction: -1 | 1) => Promise<void> | void;
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
  onAddItem: (arrangementId: string) => Promise<void> | void;
};

type SetlistItemsProps = {
  items: SetlistItemView[];
  disabled?: boolean;
  onOpenSong: (song: StoredSong) => void;
  onRemoveItem: (itemId: string) => Promise<void> | void;
  onMoveItem: (itemId: string, direction: -1 | 1) => Promise<void> | void;
};

type SetlistItemRowProps = {
  item: SetlistItemView;
  index: number;
  total: number;
  disabled?: boolean;
  onOpenSong: (song: StoredSong) => void;
  onRemoveItem: (itemId: string) => Promise<void> | void;
  onMoveItem: (itemId: string, direction: -1 | 1) => Promise<void> | void;
};

type MoveControlsProps = Pick<SetlistItemRowProps, "disabled" | "index" | "item" | "onMoveItem" | "total">;

type SetlistItemButtonProps = Pick<SetlistItemRowProps, "item" | "onOpenSong">;

type RemoveItemButtonProps = Pick<SetlistItemRowProps, "disabled" | "item" | "onRemoveItem">;

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
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (status !== "saved") return;

    const timer = window.setTimeout(() => setStatus("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [status]);

  const handleAdd = async (value: string) => {
    if (!value || status === "saving") return;

    setStatus("saving");
    try {
      await onAddItem(value);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Adicionar da biblioteca
      </label>
      <div className="flex gap-2">
        <select
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
          value=""
          disabled={disabled || status === "saving" || addable.length === 0}
          onChange={(e) => void handleAdd(e.target.value)}
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
        <AddSongStatus status={status} />
      </div>
      {status === "error" ? (
        <p className="mt-1 text-xs text-destructive">Não foi possível adicionar a música.</p>
      ) : null}
    </div>
  );
}

function AddSongStatus({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
      {status === "saving" ? <Loader2 className="size-4 animate-spin" /> : null}
      {status === "saved" ? <Check className="size-4 text-primary" /> : null}
      {status === "error" ? <span className="text-xs font-bold text-destructive">!</span> : null}
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

function SetlistItemRow(props: SetlistItemRowProps) {
  return (
    <li className="flex items-stretch gap-1 rounded-xl border border-border/60 bg-card/50 p-2">
      <MoveControls {...props} />
      <SetlistItemButton item={props.item} onOpenSong={props.onOpenSong} />
      <RemoveItemButton
        disabled={props.disabled}
        item={props.item}
        onRemoveItem={props.onRemoveItem}
      />
    </li>
  );
}

function MoveControls({ disabled, index, item, onMoveItem, total }: MoveControlsProps) {
  const [moving, setMoving] = useState(false);

  const move = async (direction: -1 | 1) => {
    if (moving) return;

    setMoving(true);
    try {
      await onMoveItem(item.itemId, direction);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="flex flex-col justify-center gap-0.5 border-r border-border/50 pr-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7"
        disabled={disabled || moving || index === 0}
        onClick={() => void move(-1)}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7"
        disabled={disabled || moving || index === total - 1}
        onClick={() => void move(1)}
      >
        <ChevronDown className="size-4" />
      </Button>
    </div>
  );
}

function setlistItemTitle(item: SetlistItemView) {
  return item.song?.title ?? "(música removida da biblioteca)";
}

function setlistItemSubtitle(item: SetlistItemView) {
  return item.song?.artist ?? item.arrangementId;
}

function SetlistItemButton({ item, onOpenSong }: SetlistItemButtonProps) {
  const openSong = () => {
    if (item.song) onOpenSong(item.song);
  };

  return (
    <button
      type="button"
      className="min-w-0 flex-1 px-2 text-left"
      disabled={!item.song}
      onClick={openSong}
    >
      <p className="truncate font-medium text-foreground">{setlistItemTitle(item)}</p>
      <p className="truncate text-xs text-muted-foreground">{setlistItemSubtitle(item)}</p>
      {item.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p> : null}
    </button>
  );
}

function RemoveItemButton({ disabled, item, onRemoveItem }: RemoveItemButtonProps) {
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    if (removing) return;

    setRemoving(true);
    try {
      await onRemoveItem(item.itemId);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-muted-foreground hover:text-destructive"
      disabled={disabled || removing}
      onClick={() => void remove()}
    >
      {removing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}
