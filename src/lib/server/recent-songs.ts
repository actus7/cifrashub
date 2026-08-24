import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { userSongs } from "@/db/schema";
import type { StoredSong } from "@/lib/types";
import { buildStoredSongRow } from "@/lib/server/stored-song-row";
import { resolveArrangementId } from "@/lib/server/song-persist";
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

function recentSongsWhere(userId: string) {
  return and(
    eq(userSongs.userId, userId),
    isNull(userSongs.folderId),
    eq(userSongs.isRecent, true),
  );
}

export async function clearRecentSongsForUser(userId: string) {
  await db.delete(userSongs).where(recentSongsWhere(userId));
}

/**
 * Cada música é upsertada individualmente (INSERT ... ON CONFLICT), em vez de apagar
 * tudo e reinserir tudo: duas chamadas concorrentes para o mesmo usuário (ex.: dois
 * efeitos de "adicionar aos recentes" disparando quase juntos — inclusive o duplo
 * disparo do React Strict Mode em dev) colidiam na unique constraint
 * (user_id, arrangement_id) porque um "delete geral + insert geral" de uma chamada
 * podia terminar bem no meio do "delete geral + insert geral" da outra. Upsert por
 * linha é seguro mesmo com chamadas concorrentes: cada INSERT resolve seu próprio
 * conflito, não existe mais uma janela de "todas as linhas apagadas, nenhuma inserida
 * ainda" para a outra chamada pisar.
 */
export async function replaceRecentSongsForUser(
  userId: string,
  songs: StoredSong[],
) {
  const arrangementIds = songs.map((song) => resolveArrangementId(song));

  await db
    .delete(userSongs)
    .where(
      arrangementIds.length > 0
        ? and(recentSongsWhere(userId), notInArray(userSongs.arrangementId, arrangementIds))
        : recentSongsWhere(userId),
    );

  await Promise.all(songs.map((song, index) => upsertRecentSong(userId, song, index)));
}

function upsertRecentSong(userId: string, song: StoredSong, position: number) {
  const row = buildStoredSongRow(userId, null, song, position, true);

  return db
    .insert(userSongs)
    .values(row)
    .onConflictDoUpdate({
      target: [userSongs.userId, userSongs.arrangementId],
      targetWhere: sql`${userSongs.folderId} is null and ${userSongs.isRecent} = true`,
      set: {
        songId: row.songId,
        title: row.title,
        artist: row.artist,
        artistSlug: row.artistSlug,
        slug: row.slug,
        youtubeId: row.youtubeId,
        songData: row.songData,
        tone: row.tone,
        capo: row.capo,
        uiPrefs: row.uiPrefs,
        sourceArtistSlug: row.sourceArtistSlug,
        sourceSlug: row.sourceSlug,
        isRecent: true,
        position,
        updatedAt: new Date(),
      },
    });
}
