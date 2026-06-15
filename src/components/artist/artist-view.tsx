"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Music, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchSongsByArtist } from "@/hooks/use-search";
import type { SearchResultSong } from "@/lib/types";

type ArtistViewProps = {
  artistName: string;
  artistSlug: string;
  onBack: () => void;
  onOpenSong: (song: SearchResultSong) => void;
};

type LoadArtistSongsArgs = {
  artistName: string;
  artistSlug: string;
  isCancelled: () => boolean;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setSongs: (songs: SearchResultSong[]) => void;
};

async function loadArtistSongs({
  artistName,
  artistSlug,
  isCancelled,
  setError,
  setLoading,
  setSongs,
}: LoadArtistSongsArgs) {
  setLoading(true);
  setError(null);
  const result = await fetchArtistSongsResult(artistSlug, artistName);
  if (isCancelled()) return;
  applyArtistLoadResult(result, setSongs, setError);
  setLoading(false);
}

type ArtistSongsResult =
  | { songs: SearchResultSong[]; error?: never }
  | { songs?: never; error: string };

async function fetchArtistSongsResult(
  artistSlug: string,
  artistName: string,
): Promise<ArtistSongsResult> {
  try {
    return { songs: await fetchSongsByArtist(artistSlug, artistName) };
  } catch {
    return { error: "Não foi possível carregar as músicas do artista." };
  }
}

function applyArtistLoadResult(
  result: ArtistSongsResult,
  setSongs: (songs: SearchResultSong[]) => void,
  setError: (error: string | null) => void,
) {
  setSongs(result.songs ?? []);
  setError(result.error ?? null);
}

export function ArtistView({
  artistName,
  artistSlug,
  onBack,
  onOpenSong,
}: ArtistViewProps) {
  const [songs, setSongs] = useState<SearchResultSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadArtistSongs({
      artistName,
      artistSlug,
      isCancelled: () => cancelled,
      setError,
      setLoading,
      setSongs,
    });

    return () => {
      cancelled = true;
    };
  }, [artistName, artistSlug]);

  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/30">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-1 rounded-xl text-muted-foreground"
            onClick={onBack}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground">
                {artistName}
              </h1>
              <p className="text-xs text-muted-foreground">Todas as músicas</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-4">
        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando músicas...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : songs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
            Nenhuma música encontrada para esse artista.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {songs.map((song, idx) => (
              <button
                key={`${song.artistSlug}-${song.slug}-${idx}`}
                type="button"
                onClick={() => onOpenSong(song)}
                className="group/item flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover/item:bg-primary/15 group-hover/item:text-primary">
                  <Music className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {song.title}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {song.artistName}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
