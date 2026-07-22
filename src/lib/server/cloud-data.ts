import { and, asc, eq } from "drizzle-orm";
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
      .returning();
    return created ? [created] : [];
  }

  if (existing.some((folder) => folder.isDefault)) return existing;

  const defaultFolder =
    existing.find((folder) => folder.title === "Favoritos") ?? existing[0]!;
  const updatedAt = new Date();
  await db
    .update(userFolders)
    .set({ isDefault: true, updatedAt })
    .where(eq(userFolders.id, defaultFolder.id));

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

export async function assertFolderOwner(userId: string, folderId: string) {
  const [row] = await db
    .select()
    .from(userFolders)
    .where(and(eq(userFolders.id, folderId), eq(userFolders.userId, userId)))
    .limit(1);
  return row ?? null;
}
