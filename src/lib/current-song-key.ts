import type { CurrentSongMeta } from "@/lib/types";

export function currentSongKey(m: CurrentSongMeta): string {
  return m.arrangementId ?? m.id;
}
