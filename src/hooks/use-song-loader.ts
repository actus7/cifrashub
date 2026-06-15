"use client";

import type { StoredSong } from "@/lib/types";

/**
 * O `youtubeId` fica em `<script>` na página principal. No browser, fetch direto ao
 * Cifra Club falha por CORS e proxies costumam remover scripts — a rota `/api/cifra-youtube`
 * busca o HTML no servidor (sem CORS) e extrai o ID.
 */
export async function enrichStoredSongWithYoutube(
  song: StoredSong,
  signal?: AbortSignal,
): Promise<StoredSong> {
  if (song.youtubeId) return song;
  signal?.throwIfAborted();

  let youtubeId: string | null = null;
  try {
    const params = new URLSearchParams({
      artistSlug: song.artistSlug,
      slug: song.slug,
    });
    const res = await fetch(`/api/cifra-youtube?${params}`, { signal });
    if (res.ok) {
      const data = (await res.json()) as { youtubeId?: string | null };
      const raw = data.youtubeId?.trim();
      if (raw && /^[a-zA-Z0-9_-]{11}$/.test(raw)) youtubeId = raw;
    }
  } catch {
    /* abort / rede */
  }

  return youtubeId ? { ...song, youtubeId } : song;
}
