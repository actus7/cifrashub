import type { CurrentSongMeta, StoredSong } from "@/lib/types";

/** Chave estável para localizar o mesmo arranjo em pastas/recentes e ao persistir. */
export function arrangementKey(
  s: Pick<StoredSong, "id" | "arrangementId">,
): string {
  return s.arrangementId ?? s.id;
}

export function currentSongKey(m: CurrentSongMeta): string {
  return m.arrangementId ?? m.id;
}

/**
 * Identidade da música, independente do arranjo. Cada fetch gera um
 * `arrangementId` novo, então "Tocadas Recentemente" deve deduplicar por
 * música (senão reabrir a mesma cifra a duplica na lista).
 */
export function songIdentityKey(
  s: Pick<StoredSong, "id" | "artistSlug" | "slug">,
): string {
  if (!s) return "";
  return s.id?.trim() || `${s.artistSlug ?? ""}-${s.slug ?? ""}`;
}

/**
 * Mantém só a entrada mais recente de cada música, preservando a ordem.
 * Defensivo: roda em toda escrita de recentes, com dados que podem vir
 * malformados do localStorage ou da nuvem.
 */
export function dedupeRecentesBySong<T extends Pick<StoredSong, "id" | "artistSlug" | "slug">>(
  songs: T[],
): T[] {
  if (!Array.isArray(songs)) return [];
  const seen = new Set<string>();
  return songs.filter((song) => {
    if (!song) return false;
    const key = songIdentityKey(song);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
