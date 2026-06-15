"use client";

import { Loader2, Music, Search, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { SearchResultArtist, SearchResultSong } from "@/lib/types";

type SearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  results: Array<SearchResultSong | SearchResultArtist>;
  isSearching: boolean;
  onSelect: (res: SearchResultSong) => void;
  onSelectArtist?: (artist: SearchResultArtist) => void;
  showResults?: boolean;
  className?: string;
  placeholder?: string;
};

type SearchInputProps = Pick<
  SearchBarProps,
  "value" | "onChange" | "isSearching" | "placeholder"
>;

type SearchResultsProps = Pick<SearchBarProps, "results" | "onSelect" | "onSelectArtist">;

type SearchResultItemProps = {
  result: SearchResultSong | SearchResultArtist;
  onSelect: SearchBarProps["onSelect"];
  onSelectArtist: SearchBarProps["onSelectArtist"];
};

function shouldShowDropdown(value: string, showResults: boolean, results: unknown[]) {
  return showResults && value.trim().length >= 2 && results.length > 0;
}

function SearchInput({ value, onChange, isSearching, placeholder }: SearchInputProps) {
  return (
    <div className="relative flex items-center rounded-2xl border border-border bg-card/80 shadow-lg ring-1 ring-white/[0.03] backdrop-blur-sm transition-all duration-200 focus-within:border-primary/40 focus-within:shadow-primary/5 focus-within:shadow-xl">
      <Search className="absolute left-4 size-[18px] text-muted-foreground/70" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-13 rounded-2xl border-0 bg-transparent pl-11 pr-12 text-[15px] shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
      />
      <SearchInputAction value={value} onChange={onChange} isSearching={isSearching} />
    </div>
  );
}

function SearchInputAction({ value, onChange, isSearching }: Omit<SearchInputProps, "placeholder">) {
  if (isSearching) {
    return <Loader2 className="absolute right-4 size-[18px] animate-spin text-primary" />;
  }

  if (!value) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="absolute right-2.5 rounded-lg text-muted-foreground hover:text-foreground"
      onClick={() => onChange("")}
    >
      <X className="size-4" />
    </Button>
  );
}

function SearchResults({ results, onSelect, onSelectArtist }: SearchResultsProps) {
  return (
    <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-black/20 animate-in fade-in slide-in-from-top-1 duration-150">
      <ScrollArea className="max-h-80">
        <div className="flex flex-col p-1.5">
          {results.map((result, i) => (
            <SearchResultItem
              key={`${result.type}-${i}`}
              result={result}
              onSelect={onSelect}
              onSelectArtist={onSelectArtist}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function SearchResultItem({ result, onSelect, onSelectArtist }: SearchResultItemProps) {
  return result.type === "song" ? (
    <SongResultButton result={result} onSelect={onSelect} />
  ) : (
    <ArtistResultButton result={result} onSelectArtist={onSelectArtist} />
  );
}

function ResultIcon({ type }: { type: SearchResultSong["type"] | SearchResultArtist["type"] }) {
  const Icon = type === "song" ? Music : UserRound;
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover/item:bg-primary/15 group-hover/item:text-primary">
      <Icon className="size-4" />
    </div>
  );
}

function SongResultButton({ result, onSelect }: { result: SearchResultSong; onSelect: SearchBarProps["onSelect"] }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
    >
      <ResultIcon type="song" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{result.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{result.artistName}</p>
      </div>
    </button>
  );
}

function ArtistResultButton({
  result,
  onSelectArtist,
}: {
  result: SearchResultArtist;
  onSelectArtist: SearchBarProps["onSelectArtist"];
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectArtist?.(result)}
      className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
    >
      <ResultIcon type="artist" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{result.artistName}</p>
        <p className="truncate text-[11px] text-muted-foreground">Ver músicas do artista</p>
      </div>
    </button>
  );
}

export function SearchBar({
  value,
  onChange,
  results,
  isSearching,
  onSelect,
  onSelectArtist,
  showResults = true,
  className,
  placeholder = "Busque uma música ou artista...",
}: SearchBarProps) {
  const showDropdown = shouldShowDropdown(value, showResults, results);

  return (
    <div className={cn("relative w-full max-w-xl group", className)}>
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/10 blur-2xl opacity-0 transition-opacity duration-700 group-focus-within:opacity-100" />
      <SearchInput
        value={value}
        onChange={onChange}
        isSearching={isSearching}
        placeholder={placeholder}
      />
      {showDropdown && (
        <SearchResults
          results={results}
          onSelect={onSelect}
          onSelectArtist={onSelectArtist}
        />
      )}
    </div>
  );
}
