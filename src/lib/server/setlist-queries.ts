import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { userSetlistItems, userSetlists, userSongs } from "@/db/schema";
import type { StoredSong } from "@/lib/types";
import { rowToStoredSong } from "@/lib/server/cloud-data";

type SetlistListRow = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  updatedAt: Date;
};

export async function listSetlistsForUser(userId: string): Promise<SetlistListRow[]> {
  return db
    .select({
      id: userSetlists.id,
      title: userSetlists.title,
      description: userSetlists.description,
      position: userSetlists.position,
      updatedAt: userSetlists.updatedAt,
    })
    .from(userSetlists)
    .where(eq(userSetlists.userId, userId))
    .orderBy(asc(userSetlists.position), asc(userSetlists.createdAt));
}

type SetlistItemWithSong = {
  itemId: string;
  position: number;
  arrangementId: string;
  notes: string | null;
  song: StoredSong | null;
};

export async function getSetlistDetail(
  userId: string,
  setlistId: string,
): Promise<{
  id: string;
  title: string;
  description: string | null;
  position: number;
  updatedAt: Date;
  items: SetlistItemWithSong[];
} | null> {
  const [sl] = await db
    .select()
    .from(userSetlists)
    .where(and(eq(userSetlists.id, setlistId), eq(userSetlists.userId, userId)))
    .limit(1);
  if (!sl) return null;

  const items = await db
    .select()
    .from(userSetlistItems)
    .where(eq(userSetlistItems.setlistId, setlistId))
    .orderBy(asc(userSetlistItems.position), asc(userSetlistItems.createdAt));

  const neededAids = [...new Set(items.map((it) => it.arrangementId))];
  const songs =
    neededAids.length > 0
      ? await db
          .select()
          .from(userSongs)
          .where(
            and(
              eq(userSongs.userId, userId),
              inArray(userSongs.arrangementId, neededAids),
            ),
          )
      : [];

  const byArr = new Map<string, (typeof userSongs.$inferSelect)[]>();
  for (const r of songs) {
    const k = r.arrangementId;
    const list = byArr.get(k) ?? [];
    list.push(r);
    byArr.set(k, list);
  }

  const itemsOut: SetlistItemWithSong[] = items.map((it) => {
    const rows = byArr.get(it.arrangementId) ?? [];
    const row =
      rows.find((r) => r.folderId !== null) ?? rows.find((r) => r.isRecent) ?? rows[0];
    return {
      itemId: it.id,
      position: it.position,
      arrangementId: it.arrangementId,
      notes: it.notes,
      song: row ? rowToStoredSong(row) : null,
    };
  });

  return {
    id: sl.id,
    title: sl.title,
    description: sl.description,
    position: sl.position,
    updatedAt: sl.updatedAt,
    items: itemsOut,
  };
}

export async function assertUserOwnsArrangement(
  userId: string,
  arrangementId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: userSongs.id })
    .from(userSongs)
    .where(
      and(eq(userSongs.userId, userId), eq(userSongs.arrangementId, arrangementId)),
    )
    .limit(1);
  return Boolean(row);
}

export async function assertUserOwnsSetlist(
  userId: string,
  setlistId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: userSetlists.id })
    .from(userSetlists)
    .where(and(eq(userSetlists.id, setlistId), eq(userSetlists.userId, userId)))
    .limit(1);
  return Boolean(row);
}
