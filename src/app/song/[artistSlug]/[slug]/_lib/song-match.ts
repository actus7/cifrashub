import type { StoredSong } from "@/lib/types";

export function songMatches(a: StoredSong | null | undefined, b: StoredSong | null) {
  return Boolean(a && b && a.artistSlug === b.artistSlug && a.slug === b.slug);
}
