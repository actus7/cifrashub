import { flattenLibrarySongs } from "@/lib/library-flat";
import { arrangementKey } from "@/lib/arrangement-key";
import type {
  Folder,
  LocalSetlistStored,
  SetlistDetailView,
  SetlistItemView,
  SetlistSummary,
  StoredSong,
} from "@/lib/types";

export function localSetlistsToSummaries(
  list: LocalSetlistStored[],
): SetlistSummary[] {
  return list.map((s, i) => ({
    id: s.id,
    title: s.title,
    description: s.description ?? null,
    position: i,
    updatedAt: new Date().toISOString(),
  }));
}

export function buildLocalSetlistDetail(
  stored: LocalSetlistStored,
  folders: Folder[],
  recentes: StoredSong[],
): SetlistDetailView {
  const lib = flattenLibrarySongs(folders, recentes);
  const byArr = new Map(lib.map((s) => [arrangementKey(s), s] as const));
  const items: SetlistItemView[] = stored.items.map((it, idx) => ({
    itemId: it.itemId,
    position: idx,
    arrangementId: it.arrangementId,
    notes: it.notes ?? null,
    song: byArr.get(it.arrangementId) ?? null,
  }));
  return {
    id: stored.id,
    title: stored.title,
    description: stored.description ?? null,
    position: 0,
    updatedAt: new Date().toISOString(),
    items,
  };
}
