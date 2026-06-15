"use client";

import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSearchDebounced } from "@/hooks/use-search";
import type { SearchResultSong, StoredSong } from "@/lib/types";

type FolderSearchProps = {
  query: string;
  onQueryChange: (q: string) => void;
  activeFolderSongs: StoredSong[];
  folderAddPendingKey: string | null;
  onAddSong: (res: SearchResultSong) => void;
};

type FolderSearchInputProps = Pick<FolderSearchProps, "query" | "onQueryChange"> & {
  isSearching: boolean;
};

type FolderSearchResultsProps = Pick<
  FolderSearchProps,
  "activeFolderSongs" | "folderAddPendingKey" | "onAddSong"
> & {
  isSearching: boolean;
  songResults: SearchResultSong[];
};

type FolderSearchResultProps = Pick<
  FolderSearchProps,
  "folderAddPendingKey" | "onAddSong"
> & {
  inFolder: boolean;
  result: SearchResultSong;
};

function songKey(song: SearchResultSong) {
  return `${song.artistSlug}-${song.slug}`;
}

function folderSongKeys(songs: StoredSong[]) {
  return new Set(songs.map((song) => song.id));
}

function FolderSearchInput({ query, onQueryChange, isSearching }: FolderSearchInputProps) {
  return (
    <div className="relative flex items-center gap-2 overflow-hidden rounded-2xl border border-border bg-card shadow-lg focus-within:border-primary/50">
      <Search className="absolute left-4 size-[18px] text-muted-foreground" />
      <Input
        type="text"
        placeholder="Pesquisar e adicionar mais cifras..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="h-12 border-0 bg-transparent pl-12 pr-10 text-sm shadow-none focus-visible:ring-0"
      />
      <FolderSearchInputAction query={query} onQueryChange={onQueryChange} isSearching={isSearching} />
    </div>
  );
}

function FolderSearchInputAction({ query, onQueryChange, isSearching }: FolderSearchInputProps) {
  if (isSearching) return <Loader2 className="absolute right-4 size-4 animate-spin text-primary" />;
  if (!query) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="absolute right-2 text-muted-foreground"
      onClick={() => onQueryChange("")}
    >
      <X className="size-4" />
    </Button>
  );
}

function FolderSearchResults({
  activeFolderSongs,
  folderAddPendingKey,
  isSearching,
  onAddSong,
  songResults,
}: FolderSearchResultsProps) {
  const activeKeys = folderSongKeys(activeFolderSongs);

  return (
    <div className="absolute top-full right-0 left-0 z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
      <ScrollArea className="max-h-[300px]">
        <div className="flex flex-col gap-0.5 p-2">
          {songResults.length === 0 && !isSearching ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </p>
          ) : (
            songResults.map((result, i) => (
              <FolderSearchResult
                key={`${result.slug}-${i}`}
                result={result}
                inFolder={activeKeys.has(songKey(result))}
                folderAddPendingKey={folderAddPendingKey}
                onAddSong={onAddSong}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FolderSearchResult({
  folderAddPendingKey,
  inFolder,
  onAddSong,
  result,
}: FolderSearchResultProps) {
  const key = songKey(result);

  return (
    <button
      type="button"
      disabled={folderAddPendingKey !== null || inFolder}
      onClick={() => onAddSong(result)}
      className="flex w-full items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="min-w-0 flex-1 pr-4">
        <p className="truncate text-sm font-bold text-foreground">{result.title}</p>
        <p className="truncate text-xs text-muted-foreground">{result.artistName}</p>
      </div>
      <FolderSearchResultIcon pending={folderAddPendingKey === key} inFolder={inFolder} />
    </button>
  );
}

function FolderSearchResultIcon({ pending, inFolder }: { pending: boolean; inFolder: boolean }) {
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
        inFolder
          ? "bg-muted text-muted-foreground"
          : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : inFolder ? (
        <Check className="size-4" />
      ) : (
        <Plus className="size-4" />
      )}
    </div>
  );
}

export function FolderSearch({
  query,
  onQueryChange,
  activeFolderSongs,
  folderAddPendingKey,
  onAddSong,
}: FolderSearchProps) {
  const { results, isSearching } = useSearchDebounced(query);
  const songResults = results.filter(
    (res): res is SearchResultSong => res.type === "song",
  );
  const showDropdown = query.trim().length >= 2;

  return (
    <div className="relative mb-8 w-full">
      <FolderSearchInput query={query} onQueryChange={onQueryChange} isSearching={isSearching} />
      {showDropdown && (
        <FolderSearchResults
          activeFolderSongs={activeFolderSongs}
          folderAddPendingKey={folderAddPendingKey}
          isSearching={isSearching}
          onAddSong={onAddSong}
          songResults={songResults}
        />
      )}
    </div>
  );
}
