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

type SetlistDetail = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  updatedAt: Date;
  items: SetlistItemWithSong[];
};

type SetlistItemRow = typeof userSetlistItems.$inferSelect;

type SongRow = typeof userSongs.$inferSelect;

export async function getSetlistDetail(userId: string, setlistId: string): Promise<SetlistDetail | null> {
  const setlist = await findUserSetlist(userId, setlistId);
  if (!setlist) return null;

  const items = await setlistItems(setlistId);
  const songsByArrangement = await setlistSongsByArrangement(userId, items);

  return {
    id: setlist.id,
    title: setlist.title,
    description: setlist.description,
    position: setlist.position,
    updatedAt: setlist.updatedAt,
    items: items.map((item) => setlistItemWithSong(item, songsByArrangement)),
  };
}

async function findUserSetlist(userId: string, setlistId: string) {
  const [setlist] = await db
    .select()
    .from(userSetlists)
    .where(and(eq(userSetlists.id, setlistId), eq(userSetlists.userId, userId)))
    .limit(1);
  return setlist ?? null;
}

function setlistItems(setlistId: string) {
  return db
    .select()
    .from(userSetlistItems)
    .where(eq(userSetlistItems.setlistId, setlistId))
    .orderBy(asc(userSetlistItems.position), asc(userSetlistItems.createdAt));
}

async function setlistSongsByArrangement(userId: string, items: SetlistItemRow[]) {
  const arrangementIds = [...new Set(items.map((item) => item.arrangementId))];
  const rows = arrangementIds.length > 0 ? await setlistSongRows(userId, arrangementIds) : [];
  return groupSongsByArrangement(rows);
}

function setlistSongRows(userId: string, arrangementIds: string[]) {
  return db
    .select()
    .from(userSongs)
    .where(and(eq(userSongs.userId, userId), inArray(userSongs.arrangementId, arrangementIds)));
}

function groupSongsByArrangement(rows: SongRow[]) {
  const byArrangement = new Map<string, SongRow[]>();
  for (const row of rows) {
    const list = byArrangement.get(row.arrangementId) ?? [];
    list.push(row);
    byArrangement.set(row.arrangementId, list);
  }
  return byArrangement;
}

function setlistItemWithSong(
  item: SetlistItemRow,
  songsByArrangement: Map<string, SongRow[]>,
): SetlistItemWithSong {
  return {
    itemId: item.id,
    position: item.position,
    arrangementId: item.arrangementId,
    notes: item.notes,
    song: preferredSetlistSong(songsByArrangement.get(item.arrangementId) ?? []),
  };
}

function preferredSetlistSong(rows: SongRow[]): StoredSong | null {
  const row = rows.find((song) => song.folderId !== null) ?? rows.find((song) => song.isRecent) ?? rows[0];
  return row ? rowToStoredSong(row) : null;
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
