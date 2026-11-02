import { and, asc, eq, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { userSetlistItems, userSetlists, userSongs } from "@/db/schema";
import { rowToStoredSong } from "@/lib/server/cloud-data";
import type { StoredSong } from "@/lib/types";
import { buildStoredSongRow, songRowUpdateSet } from "@/lib/server/stored-song-row";
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

export const MAX_RECENTES = 15;

export type RecentRowRef = { arrangementId: string; position: number };

/** Linhas além de `max` (por position): apagadas, ou só desmarcadas quando fixadas por uma setlist. */
export function planRecentTrim(
  rows: RecentRowRef[],
  pinned: Set<string>,
  max = MAX_RECENTES,
): { deleteIds: string[]; unrecentIds: string[] } {
  const overflow = [...rows].sort((a, b) => a.position - b.position).slice(max);
  return {
    deleteIds: overflow.filter((r) => !pinned.has(r.arrangementId)).map((r) => r.arrangementId),
    unrecentIds: overflow.filter((r) => pinned.has(r.arrangementId)).map((r) => r.arrangementId),
  };
}

async function loadPinnedArrangementIds(userId: string, arrangementIds: string[]) {
  if (arrangementIds.length === 0) return new Set<string>();
  const found = await db
    .select({ arrangementId: userSetlistItems.arrangementId })
    .from(userSetlistItems)
    .innerJoin(userSetlists, eq(userSetlists.id, userSetlistItems.setlistId))
    .where(
      and(eq(userSetlists.userId, userId), inArray(userSetlistItems.arrangementId, arrangementIds)),
    );
  return new Set(found.map((r) => r.arrangementId));
}

async function applyRecentTrim(
  userId: string,
  plan: { deleteIds: string[]; unrecentIds: string[] },
) {
  if (plan.deleteIds.length > 0) {
    await db
      .delete(userSongs)
      .where(and(recentSongsWhere(userId), inArray(userSongs.arrangementId, plan.deleteIds)));
  }
  if (plan.unrecentIds.length > 0) {
    await db
      .update(userSongs)
      .set({ isRecent: false })
      .where(and(recentSongsWhere(userId), inArray(userSongs.arrangementId, plan.unrecentIds)));
  }
}

async function selectRecentRows(userId: string) {
  return db
    .select()
    .from(userSongs)
    .where(recentSongsWhere(userId))
    .orderBy(asc(userSongs.position));
}

export async function loadRecentSongs(userId: string): Promise<StoredSong[]> {
  return (await selectRecentRows(userId)).map(rowToStoredSong);
}

/** Apaga os recentes, preservando (como não-recentes) os usados por itens de setlist. */
export async function clearRecentSongsForUser(userId: string) {
  const rows = await selectRecentRows(userId);
  const pinned = await loadPinnedArrangementIds(userId, rows.map((r) => r.arrangementId));
  await applyRecentTrim(userId, planRecentTrim(rows, pinned, 0));
}

export async function removeRecentSong(userId: string, arrangementId: string) {
  const pinned = await loadPinnedArrangementIds(userId, [arrangementId]);
  await applyRecentTrim(
    userId,
    pinned.has(arrangementId)
      ? { deleteIds: [], unrecentIds: [arrangementId] }
      : { deleteIds: [arrangementId], unrecentIds: [] },
  );
}

/** Abre uma música: vai para o topo (position 0) sem sobrescrever conteúdo/prefs de linha existente. */
export async function touchRecentSong(userId: string, song: StoredSong) {
  const row = buildStoredSongRow(userId, null, song, 0, true);

  await db
    .update(userSongs)
    .set({ position: sql`${userSongs.position} + 1` })
    .where(and(recentSongsWhere(userId), ne(userSongs.arrangementId, row.arrangementId)));

  await db
    .insert(userSongs)
    .values(row)
    .onConflictDoUpdate({
      target: [userSongs.userId, userSongs.arrangementId],
      targetWhere: sql`${userSongs.folderId} is null and ${userSongs.isRecent} = true`,
      set: {
        title: row.title,
        artist: row.artist,
        youtubeId: row.youtubeId,
        position: 0,
        updatedAt: new Date(),
      },
    });

  const rows = await selectRecentRows(userId);
  if (rows.length <= MAX_RECENTES) return;
  const overflowIds = [...rows]
    .sort((a, b) => a.position - b.position)
    .slice(MAX_RECENTES)
    .map((r) => r.arrangementId);
  const pinned = await loadPinnedArrangementIds(userId, overflowIds);
  await applyRecentTrim(userId, planRecentTrim(rows, pinned));
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
      set: { ...songRowUpdateSet(row), isRecent: true, position },
    });
}
