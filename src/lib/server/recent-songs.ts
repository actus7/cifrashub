import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { userSongs } from "@/db/schema";
import type { StoredSong } from "@/lib/types";
import { buildStoredSongRow } from "@/lib/server/stored-song-row";
import { arrangementKey } from "@/lib/arrangement-key";

export function dedupeSongsByArrangement(
  songs: StoredSong[],
  options: { requireId?: boolean } = {},
): StoredSong[] {
  const seen = new Set<string>();
  return songs.filter((song) => keepUniqueSong(song, seen, options.requireId));
}

function keepUniqueSong(
  song: StoredSong | null | undefined,
  seen: Set<string>,
  requireId = false,
): song is StoredSong {
  if (!song || (requireId && !song.id)) return false;
  return addUniqueSongKey(seen, arrangementKey(song));
}

function addUniqueSongKey(seen: Set<string>, key: string) {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

export async function clearRecentSongsForUser(userId: string) {
  await db
    .delete(userSongs)
    .where(
      and(
        eq(userSongs.userId, userId),
        isNull(userSongs.folderId),
        eq(userSongs.isRecent, true),
      ),
    );
}

export async function replaceRecentSongsForUser(
  userId: string,
  songs: StoredSong[],
) {
  await clearRecentSongsForUser(userId);

  if (songs.length > 0) {
    await db
      .insert(userSongs)
      .values(
        songs.map((song, index) =>
          buildStoredSongRow(userId, null, song, index, true),
        ),
      );
  }
}
