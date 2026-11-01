import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { userFolders, userSongs } from "@/db/schema";
import type { Folder, StoredSong } from "@/lib/types";

type SongRow = typeof userSongs.$inferSelect;
type FolderRow = typeof userFolders.$inferSelect;

type UiPrefs = NonNullable<SongRow["uiPrefs"]>;

const uiPrefKeys = [
  "simplified",
  "showTabs",
  "nashvilleNumbers",
  "mirrored",
  "fontSizeOffset",
  "columns",
  "spacingOffset",
  "zenMode",
  "autoScroll",
  "scrollSpeed",
  "metronomeActive",
  "bpm",
] as const satisfies ReadonlyArray<keyof UiPrefs>;

function optionalSongFields(row: SongRow): Partial<StoredSong> {
  return Object.fromEntries(
    [
      ["sourceArtistSlug", row.sourceArtistSlug],
      ["sourceSlug", row.sourceSlug],
      ["youtubeId", row.youtubeId],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  ) as Partial<StoredSong>;
}

function storedUiPrefs(uiPrefs: SongRow["uiPrefs"]): Partial<StoredSong> {
  if (!uiPrefs) return {};

  return Object.fromEntries(
    uiPrefKeys
      .map((key) => [key, uiPrefs[key]] as const)
      .filter((entry) => entry[1] !== undefined),
  ) as Partial<StoredSong>;
}

export function rowToStoredSong(row: SongRow): StoredSong {
  return {
    id: row.songId,
    arrangementId: row.arrangementId,
    title: row.title,
    artist: row.artist,
    artistSlug: row.artistSlug,
    slug: row.slug,
    ...optionalSongFields(row),
    songData: row.songData,
    tone: row.tone,
    capo: row.capo,
    ...storedUiPrefs(row.uiPrefs),
  };
}

function foldersForUser(userId: string) {
  return db
    .select()
    .from(userFolders)
    .where(eq(userFolders.userId, userId))
    .orderBy(asc(userFolders.position), asc(userFolders.createdAt));
}

function songsForUser(userId: string) {
  return db
    .select()
    .from(userSongs)
    .where(eq(userSongs.userId, userId));
}

export function pickDefaultFolderToPromote<
  T extends { isDefault: boolean; title: string },
>(folders: T[]): T | undefined {
  return (
    folders.find((folder) => folder.isDefault) ??
    folders.find((folder) => folder.title === "Favoritos") ??
    folders[0]
  );
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

async function ensureDefaultFolderRows(
  userId: string,
  existing: FolderRow[],
): Promise<FolderRow[]> {
  if (existing.length === 0) {
    const [created] = await db
      .insert(userFolders)
      .values({
        userId,
        title: "Favoritos",
        position: 0,
        isDefault: true,
      })
      .onConflictDoNothing({
        target: userFolders.userId,
        where: sql`${userFolders.isDefault} = true`,
      })
      .returning();
    // Lost the race to a concurrent insert: return what the winner created.
    return created ? [created] : foldersForUser(userId);
  }

  if (existing.some((folder) => folder.isDefault)) return existing;

  const defaultFolder = pickDefaultFolderToPromote(existing)!;
  const updatedAt = new Date();
  try {
    await db
      .update(userFolders)
      .set({ isDefault: true, updatedAt })
      .where(eq(userFolders.id, defaultFolder.id));
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return foldersForUser(userId);
  }

  return existing.map((folder) =>
    folder.id === defaultFolder.id
      ? { ...folder, isDefault: true, updatedAt }
      : folder,
  );
}

/** Garante ao menos a pasta padrão “Favoritos”. */
export async function ensureDefaultFolder(userId: string) {
  await ensureDefaultFolderRows(userId, await foldersForUser(userId));
}

export async function loadCloudFoldersAndSongs(userId: string): Promise<{
  folders: Folder[];
  recentes: StoredSong[];
}> {
  const [existingFolders, songRows] = await Promise.all([
    foldersForUser(userId),
    songsForUser(userId),
  ]);
  const folderRows = await ensureDefaultFolderRows(userId, existingFolders);

  const folders: Folder[] = folderRows.map((f) => ({
    id: f.id,
    title: f.title,
    isDefault: f.isDefault,
    songs: songRows
      .filter((s) => s.folderId === f.id && !s.isRecent)
      .sort((a, b) => a.position - b.position)
      .map(rowToStoredSong),
  }));

  const recentes = songRows
    .filter((s) => s.folderId === null && s.isRecent)
    .sort((a, b) => a.position - b.position)
    .map(rowToStoredSong);

  return { folders, recentes };
}

export function preferredArrangementRow(rows: SongRow[]): SongRow | undefined {
  return rows.find((row) => row.folderId !== null) ?? rows.find((row) => row.isRecent) ?? rows[0];
}

export async function assertFolderOwner(userId: string, folderId: string) {
  const [row] = await db
    .select()
    .from(userFolders)
    .where(and(eq(userFolders.id, folderId), eq(userFolders.userId, userId)))
    .limit(1);
  return row ?? null;
}
