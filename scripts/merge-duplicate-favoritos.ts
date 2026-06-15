import { config } from "dotenv";
config();

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

type FavoriteFolder = typeof schema.userFolders.$inferSelect;
type FavoriteSong = typeof schema.userSongs.$inferSelect;

type MergeStats = {
  mergedCount: number;
  deletedCount: number;
};

async function favoriteFoldersByUser() {
  const allFolders = await db.select().from(schema.userFolders);
  const foldersByUser = new Map<string, FavoriteFolder[]>();

  for (const folder of allFolders) {
    if (folder.title !== "Favoritos") continue;
    const folders = foldersByUser.get(folder.userId) ?? [];
    folders.push(folder);
    foldersByUser.set(folder.userId, folders);
  }

  return foldersByUser;
}

function preferredFolderSort(a: FavoriteFolder, b: FavoriteFolder): number {
  if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

async function duplicateSongs(duplicateIds: string[]) {
  return db
    .select()
    .from(schema.userSongs)
    .where(inArray(schema.userSongs.folderId, duplicateIds));
}

async function rootSongs(rootFolderId: string) {
  return db
    .select()
    .from(schema.userSongs)
    .where(eq(schema.userSongs.folderId, rootFolderId));
}

async function moveSongToRoot(song: FavoriteSong, rootFolderId: string, position: number) {
  await db
    .update(schema.userSongs)
    .set({ folderId: rootFolderId, position })
    .where(eq(schema.userSongs.id, song.id));
}

async function removeDuplicateSong(songId: string) {
  await db.delete(schema.userSongs).where(eq(schema.userSongs.id, songId));
}

async function mergeSongsIntoRoot(rootFolder: FavoriteFolder, duplicateIds: string[]): Promise<number> {
  const songsInDuplicates = await duplicateSongs(duplicateIds);
  if (songsInDuplicates.length === 0) return 0;

  const songsInRoot = await rootSongs(rootFolder.id);
  const rootArrangements = new Set(songsInRoot.map((song) => song.arrangementId));
  let maxPos = songsInRoot.reduce((max, song) => Math.max(max, song.position), -1);

  for (const song of songsInDuplicates) {
    if (rootArrangements.has(song.arrangementId)) {
      await removeDuplicateSong(song.id);
      continue;
    }

    maxPos++;
    await moveSongToRoot(song, rootFolder.id, maxPos);
    rootArrangements.add(song.arrangementId);
  }

  return songsInDuplicates.length;
}

async function removeDuplicateFolders(duplicateIds: string[]) {
  await db.delete(schema.userFolders).where(inArray(schema.userFolders.id, duplicateIds));
}

async function ensureDefaultFolder(rootFolder: FavoriteFolder) {
  if (rootFolder.isDefault) return;
  await db
    .update(schema.userFolders)
    .set({ isDefault: true })
    .where(eq(schema.userFolders.id, rootFolder.id));
}

async function mergeUserFavoriteFolders(userId: string, folders: FavoriteFolder[]): Promise<MergeStats> {
  if (folders.length <= 1) return { mergedCount: 0, deletedCount: 0 };

  console.log(`Usuário ${userId} possui ${folders.length} pastas 'Favoritos'. Mesclando...`);
  const [rootFolder, ...duplicates] = [...folders].sort(preferredFolderSort);
  if (!rootFolder) return { mergedCount: 0, deletedCount: 0 };

  const duplicateIds = duplicates.map((folder) => folder.id);
  const mergedCount = await mergeSongsIntoRoot(rootFolder, duplicateIds);
  await removeDuplicateFolders(duplicateIds);
  await ensureDefaultFolder(rootFolder);

  return { mergedCount, deletedCount: duplicateIds.length };
}

async function main() {
  console.log("Iniciando varredura por pastas 'Favoritos' duplicadas...");
  const foldersByUser = await favoriteFoldersByUser();
  const stats: MergeStats = { mergedCount: 0, deletedCount: 0 };

  for (const [userId, folders] of foldersByUser.entries()) {
    const userStats = await mergeUserFavoriteFolders(userId, folders);
    stats.mergedCount += userStats.mergedCount;
    stats.deletedCount += userStats.deletedCount;
  }

  console.log("Limpeza concluída com sucesso!");
  console.log(`Músicas movidas/mescladas: ${stats.mergedCount}`);
  console.log(`Pastas duplicadas deletadas: ${stats.deletedCount}`);
  process.exit(0);
}

main().catch(err => {
  console.error("Erro na limpeza:", err);
  process.exit(1);
});
