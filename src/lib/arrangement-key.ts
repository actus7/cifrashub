import type { StoredSong } from "@/lib/types";

export function arrangementKey(
  s: Pick<StoredSong, "id" | "arrangementId">,
): string {
  return s.arrangementId ?? s.id;
}
