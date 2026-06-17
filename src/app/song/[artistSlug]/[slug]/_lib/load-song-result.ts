import type { StoredSong } from "@/lib/types";
import { fetchChordsHtml } from "@/lib/fetch-proxy";
import { processHtmlAndExtract } from "@/lib/parser";

export type LoadSongResult = { song: StoredSong } | { error: Error };

export async function loadSongResult(artistSlug: string, slug: string): Promise<LoadSongResult> {
  try {
    const html = await fetchChordsHtml(artistSlug, slug);
    return { song: processHtmlAndExtract(html, `${artistSlug}-${slug}`, "", "", artistSlug, slug) };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Erro desconhecido.") };
  }
}

export function isLoadSongError(result: LoadSongResult): result is { error: Error } {
  return "error" in result;
}
