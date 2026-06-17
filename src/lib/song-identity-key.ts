import type { StoredSong } from "@/lib/types";

export function songIdentityKey(
  s: Pick<StoredSong, "id" | "artistSlug" | "slug">,
): string {
  return s.id?.trim() || `${s.artistSlug ?? ""}-${s.slug ?? ""}`;
}
