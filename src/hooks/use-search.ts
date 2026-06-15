"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { SearchResultArtist, SearchResultSong } from "@/lib/types";

const SEARCH_URL = (q: string) =>
  `https://solr.sscdn.co/cc/c7/?q=${encodeURIComponent(q)}&limit=15&start=0`;

const ARTIST_SONGS_URL = (query: string) =>
  `https://solr.sscdn.co/cc/c7/?q=${encodeURIComponent(
    query,
  )}&limit=120&start=0`;

type SearchDoc = Record<string, unknown>;

function docText(doc: SearchDoc, key: string) {
  return String(doc[key] ?? "");
}

function songFromDoc(doc: SearchDoc): SearchResultSong {
  return {
    type: "song",
    title: docText(doc, "txt"),
    artistName: docText(doc, "art"),
    verified: !!doc.v,
    artistSlug: docText(doc, "dns"),
    slug: docText(doc, "url"),
  };
}

function artistFromDoc(doc: SearchDoc): SearchResultArtist {
  return {
    type: "artist",
    artistName: String(doc.art ?? doc.txt ?? ""),
    artistSlug: docText(doc, "dns"),
  };
}

function parseSearchSong(doc: SearchDoc): SearchResultSong | null {
  return doc.tipo === "2" ? songFromDoc(doc) : null;
}

function parseSearchResult(doc: SearchDoc): SearchResultSong | SearchResultArtist | null {
  if (doc.tipo === "2") return songFromDoc(doc);
  if (doc.tipo === "1") return artistFromDoc(doc);
  return null;
}

function docsFromResponse(data: { response?: { docs?: SearchDoc[] } }) {
  return data.response?.docs ?? [];
}

function compactParsed<T>(docs: SearchDoc[], parse: (doc: SearchDoc) => T | null) {
  return docs.flatMap((doc) => {
    const result = parse(doc);
    return result ? [result] : [];
  });
}

function uniqueSongs(songs: SearchResultSong[]) {
  const seen = new Set<string>();
  return songs.filter((song) => {
    const key = `${song.artistSlug}/${song.slug}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function songMatchesArtist(song: SearchResultSong, artistSlug: string, artistName: string) {
  if (artistSlug) return song.artistSlug === artistSlug;
  return song.artistName.toLowerCase() === artistName.toLowerCase();
}

async function fetchArtistQuerySongs(query: string) {
  const res = await fetch(ARTIST_SONGS_URL(query), { cache: "no-store" });
  if (!res.ok) return [];

  const data = (await res.json()) as { response?: { docs?: SearchDoc[] } };
  return compactParsed(docsFromResponse(data), parseSearchSong);
}

export async function fetchSongsByArtist(
  artistSlug: string,
  artistName: string,
): Promise<SearchResultSong[]> {
  const queries = [artistName, artistSlug].filter(Boolean);
  const merged: SearchResultSong[] = [];

  for (const query of queries) {
    const songs = await fetchArtistQuerySongs(query);
    merged.push(...songs.filter((song) => songMatchesArtist(song, artistSlug, artistName)));
  }

  return uniqueSongs(merged);
}

async function fetchSearchResults(query: string, signal: AbortSignal) {
  const res = await fetch(SEARCH_URL(query), { signal });
  if (!res.ok) throw new Error("search failed");

  const data = (await res.json()) as { response?: { docs?: SearchDoc[] } };
  const parsed = compactParsed(docsFromResponse(data), parseSearchResult);
  const songs = parsed.filter((r) => r.type === "song");
  const artists = parsed.filter((r) => r.type === "artist");
  return [...artists, ...songs];
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function cancelAndResetSearch(abortRef: RefObject<AbortController | null>) {
  abortRef.current?.abort();
  abortRef.current = null;
}

function startDebouncedSearch(
  abortRef: RefObject<AbortController | null>,
  query: string,
  debounceMs: number,
  setRequestId: (id: number) => void,
  setResults: (results: Array<SearchResultSong | SearchResultArtist>) => void,
  setSettledId: (id: number) => void,
) {
  const id = Date.now();
  const timeout = setTimeout(() => {
    const controller = nextSearchController(abortRef);
    setRequestId(id);
    void fetchSearchResults(query, controller.signal)
      .then((nextResults) => applySearchResults(controller, nextResults, id, setResults, setSettledId))
      .catch((error) => handleSearchError(error, controller, id, setResults, setSettledId));
  }, debounceMs);

  return () => {
    clearTimeout(timeout);
    abortRef.current?.abort();
  };
}

function nextSearchController(abortRef: RefObject<AbortController | null>) {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  return controller;
}

function applySearchResults(
  controller: AbortController,
  nextResults: Array<SearchResultSong | SearchResultArtist>,
  id: number,
  setResults: (results: Array<SearchResultSong | SearchResultArtist>) => void,
  setSettledId: (id: number) => void,
) {
  if (controller.signal.aborted) return;
  setResults(nextResults);
  setSettledId(id);
}

function handleSearchError(
  error: unknown,
  controller: AbortController,
  id: number,
  setResults: (results: Array<SearchResultSong | SearchResultArtist>) => void,
  setSettledId: (id: number) => void,
) {
  if (isAbortError(error) || controller.signal.aborted) return;
  setResults([]);
  setSettledId(id);
}

type SearchDebounceOptions = { debounceMs?: number; minLength?: number };

function normalizedSearchOptions(options?: SearchDebounceOptions) {
  return {
    debounceMs: normalizedDebounceMs(options),
    minLength: normalizedMinLength(options),
  };
}

function normalizedDebounceMs(options?: SearchDebounceOptions) {
  return options?.debounceMs ?? 400;
}

function normalizedMinLength(options?: SearchDebounceOptions) {
  return options?.minLength ?? 2;
}

function shouldRunSearch(query: string, minLength: number): boolean {
  return query.trim().length >= minLength;
}

function visibleSearchResults(
  shouldSearch: boolean,
  results: Array<SearchResultSong | SearchResultArtist>,
) {
  return shouldSearch ? results : [];
}

function searchIsPending(shouldSearch: boolean, requestId: number, settledId: number): boolean {
  return shouldSearch && requestId !== settledId;
}

export function useSearchDebounced(query: string, options?: SearchDebounceOptions) {
  const { debounceMs, minLength } = normalizedSearchOptions(options);
  const [results, setResults] = useState<Array<SearchResultSong | SearchResultArtist>>([]);
  const [requestId, setRequestId] = useState(0);
  const [settledId, setSettledId] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const shouldSearch = useMemo(() => shouldRunSearch(query, minLength), [query, minLength]);

  useEffect(() => {
    if (!shouldSearch) return cancelAndResetSearch(abortRef);
    return startDebouncedSearch(abortRef, query, debounceMs, setRequestId, setResults, setSettledId);
  }, [shouldSearch, query, debounceMs]);

  return {
    results: visibleSearchResults(shouldSearch, results),
    isSearching: searchIsPending(shouldSearch, requestId, settledId),
  };
}
