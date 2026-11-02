import { arrangementKey } from "@/lib/arrangement-key";
import type { SetlistItemView, StoredSong } from "@/lib/types";

export function songHref(
  song: StoredSong,
  ctx: { setlistId: string; position: number; ownerId?: string | null; stage?: boolean },
): string {
  const params = new URLSearchParams({
    arrangementId: arrangementKey(song),
    setlist: ctx.setlistId,
    pos: String(ctx.position),
  });
  if (ctx.ownerId) params.set("ownerId", ctx.ownerId);
  if (ctx.stage) params.set("stage", "1");
  return `/song/${song.artistSlug}/${song.slug}?${params.toString()}`;
}

type NavItem = SetlistItemView & { song: StoredSong };

/** Closest playable (song != null) items around `pos`. */
export function neighbors(
  items: SetlistItemView[],
  pos: number,
): { prev: NavItem | null; next: NavItem | null } {
  const playable = items
    .filter((i): i is NavItem => i.song !== null)
    .sort((a, b) => a.position - b.position);
  const prev = [...playable].reverse().find((i) => i.position < pos) ?? null;
  const next = playable.find((i) => i.position > pos) ?? null;
  return { prev, next };
}
