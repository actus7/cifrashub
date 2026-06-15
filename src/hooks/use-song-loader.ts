"use client";

import type { StoredSong } from "@/lib/types";
import { isValidYoutubeId } from "@/lib/youtube";

function cifraYoutubeUrl(song: StoredSong) {
  const params = new URLSearchParams({
    artistSlug: song.artistSlug,
    slug: song.slug,
  });
  return `/api/cifra-youtube?${params}`;
}

function validYoutubeId(value: string | null | undefined) {
  const raw = value?.trim();
  return isValidYoutubeId(raw) ? raw : null;
}

async function fetchYoutubeId(song: StoredSong, signal?: AbortSignal) {
  try {
    const res = await fetch(cifraYoutubeUrl(song), { signal });
    if (!res.ok) return null;

    const data = (await res.json()) as { youtubeId?: string | null };
    return validYoutubeId(data.youtubeId);
  } catch {
    return null;
  }
}

export async function enrichStoredSongWithYoutube(
  song: StoredSong,
  signal?: AbortSignal,
): Promise<StoredSong> {
  if (song.youtubeId) return song;
  signal?.throwIfAborted();

  const youtubeId = await fetchYoutubeId(song, signal);
  return youtubeId ? { ...song, youtubeId } : song;
}
