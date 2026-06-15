"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchResultArtist, SearchResultSong } from "@/lib/types";

const SEARCH_URL = (q: string) =>
  `https://solr.sscdn.co/cc/c7/?q=${encodeURIComponent(q)}&limit=15&start=0`;

const ARTIST_SONGS_URL = (query: string) =>
  `https://solr.sscdn.co/cc/c7/?q=${encodeURIComponent(
    query,
  )}&limit=120&start=0`;

type SearchDoc = Record<string, unknown>;

function parseSearchSong(doc: SearchDoc): SearchResultSong | null {
  if (doc.tipo !== "2") return null;
  return {
    type: "song",
    title: String(doc.txt ?? ""),
    artistName: String(doc.art ?? ""),
    verified: !!doc.v,
    artistSlug: String(doc.dns ?? ""),
    slug: String(doc.url ?? ""),
  };
}

function parseSearchResult(doc: SearchDoc): SearchResultSong | SearchResultArtist | null {
  const song = parseSearchSong(doc);
  if (song) return song;
  if (doc.tipo !== "1") return null;
  return {
    type: "artist",
    artistName: String(doc.art ?? doc.txt ?? ""),
    artistSlug: String(doc.dns ?? ""),
  };
}

export async function fetchSongsByArtist(
  artistSlug: string,
  artistName: string,
): Promise<SearchResultSong[]> {
  const queries = [artistName, artistSlug].filter(Boolean);
  const merged: SearchResultSong[] = [];

  for (const query of queries) {
    const res = await fetch(ARTIST_SONGS_URL(query), { cache: "no-store" });
    if (!res.ok) continue;

    const data = (await res.json()) as {
      response?: { docs?: SearchDoc[] };
    };
    const parsed = (data.response?.docs ?? []).flatMap((doc) => {
      const song = parseSearchSong(doc);
      return song ? [song] : [];
    });

    merged.push(
      ...parsed.filter((song) =>
        artistSlug
          ? song.artistSlug === artistSlug
          : song.artistName.toLowerCase() === artistName.toLowerCase(),
      ),
    );
  }

  const seen = new Set<string>();
  return merged.filter((song) => {
    const key = `${song.artistSlug}/${song.slug}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useSearchDebounced(
  query: string,
  options?: { debounceMs?: number; minLength?: number },
) {
  const debounceMs = options?.debounceMs ?? 400;
  const minLength = options?.minLength ?? 2;

  const [results, setResults] = useState<Array<SearchResultSong | SearchResultArtist>>([]);
  const [requestId, setRequestId] = useState(0);
  const [settledId, setSettledId] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const shouldSearch = useMemo(
    () => query.trim().length >= minLength,
    [query, minLength],
  );

  useEffect(() => {
    if (!shouldSearch) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    const id = Date.now();
    const t = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRequestId(id);

      fetch(SEARCH_URL(query), { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error("search failed");
          return res.json();
        })
        .then((data: { response?: { docs?: SearchDoc[] } }) => {
          if (controller.signal.aborted) return;
          const parsed = (data.response?.docs ?? []).flatMap((doc) => {
            const result = parseSearchResult(doc);
            return result ? [result] : [];
          });

          const songs = parsed.filter((r) => r.type === "song");
          const artists = parsed.filter((r) => r.type === "artist");
          setResults([...artists, ...songs]);
          setSettledId(id);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (!controller.signal.aborted) {
            setResults([]);
            setSettledId(id);
          }
        });
    }, debounceMs);

    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
  }, [shouldSearch, query, debounceMs]);

  return {
    results: shouldSearch ? results : [],
    isSearching: shouldSearch && requestId !== settledId,
  };
}
