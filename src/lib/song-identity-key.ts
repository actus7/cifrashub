import type { StoredSong } from "@/lib/types";

type SongIdentity = Pick<StoredSong, "id" | "artistSlug" | "slug">;

export function songIdentityKey(s: SongIdentity | null | undefined): string {
  return s ? songIdentityValue(s) : "";
}

function songIdentityValue(s: SongIdentity): string {
  const id = s.id?.trim();
  return id || `${s.artistSlug ?? ""}-${s.slug ?? ""}`;
}
