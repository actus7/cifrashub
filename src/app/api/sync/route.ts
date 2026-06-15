import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userFolders, userSongs } from "@/db/schema";
import type { Folder, StoredSong } from "@/lib/types";
import { requireApiUserJson } from "@/lib/server/api-route";
import { nextPosition } from "@/lib/server/positions";
import {
  ensureDefaultFolder,
  loadCloudFoldersAndSongs,
} from "@/lib/server/cloud-data";
import {
  resolveArrangementId,
  sourceArtistSlugForRow,
  sourceSlugForRow,
} from "@/lib/server/song-persist";
import {
  buildStoredSongRow,
  toneCapoUiFromStored,
  youtubeIdForRow,
} from "@/lib/server/stored-song-row";
import {
  dedupeSongsByArrangement,
  replaceRecentSongsForUser,
} from "@/lib/server/recent-songs";
import { arrangementKey } from "@/lib/stored-song-key";

type SyncBody = {
  folders?: Folder[];
  recentes?: StoredSong[];
};

type CloudFolderRow = typeof userFolders.$inferSelect;
type CloudSongRow = typeof userSongs.$inferSelect;
type SongUpdate = { id: string; song: StoredSong };
type SongInsert = ReturnType<typeof buildStoredSongRow> & { id?: undefined };

type SongSyncState = {
  existingByKey: Map<string, CloudSongRow>;
  maxPosByFolder: Map<string, number>;
  toUpdate: SongUpdate[];
  toInsert: SongInsert[];
};

function songFolderKey(folderId: string | null, arrangementId: string) {
  return `${folderId ?? ""}|${arrangementId}`;
}

function updateMaxFolderPosition(maxPosByFolder: Map<string, number>, row: CloudSongRow) {
  if (!row.folderId) return;
  const current = maxPosByFolder.get(row.folderId) ?? -1;
  if (row.position > current) maxPosByFolder.set(row.folderId, row.position);
}

async function resolveFolderId(
  userId: string,
  localFolder: Folder,
  cloudFolders: CloudFolderRow[],
): Promise<string> {
  const isDefaultLocal = isDefaultFolder(localFolder);
  const existing = existingCloudFolder(localFolder, cloudFolders, isDefaultLocal);
  if (existing) return existing.id;

  const created = await createCloudFolder(userId, localFolder, cloudFolders, isDefaultLocal);
  cloudFolders.push(created);
  return created.id;
}

function isDefaultFolder(folder: Folder): boolean {
  return folder.isDefault || folder.id === "default" || folder.title === "Favoritos";
}

function existingCloudFolder(
  localFolder: Folder,
  cloudFolders: CloudFolderRow[],
  isDefaultLocal: boolean,
): CloudFolderRow | undefined {
  return defaultCloudFolder(cloudFolders, isDefaultLocal) ?? namedCloudFolder(cloudFolders, localFolder.title);
}

function defaultCloudFolder(
  cloudFolders: CloudFolderRow[],
  isDefaultLocal: boolean,
): CloudFolderRow | undefined {
  if (!isDefaultLocal) return undefined;
  return cloudFolders.find((f) => f.isDefault || f.title === "Favoritos");
}

function namedCloudFolder(cloudFolders: CloudFolderRow[], title: string): CloudFolderRow | undefined {
  return cloudFolders.find((f) => f.title === title);
}

async function createCloudFolder(
  userId: string,
  localFolder: Folder,
  cloudFolders: CloudFolderRow[],
  isDefaultLocal: boolean,
): Promise<CloudFolderRow> {
  const [created] = await db
    .insert(userFolders)
    .values({
      userId,
      title: localFolder.title,
      position: nextPosition(cloudFolders),
      isDefault: isDefaultLocal,
    })
    .returning();

  return created!;
}

function createSongSyncState(allCloudSongs: CloudSongRow[]): SongSyncState {
  const state: SongSyncState = {
    existingByKey: new Map(),
    maxPosByFolder: new Map(),
    toUpdate: [],
    toInsert: [],
  };

  for (const row of allCloudSongs) {
    state.existingByKey.set(songFolderKey(row.folderId, row.arrangementId), row);
    updateMaxFolderPosition(state.maxPosByFolder, row);
  }

  return state;
}

async function collectFolderSongs(
  userId: string,
  localFolders: Folder[],
  cloudFolderRows: CloudFolderRow[],
  state: SongSyncState,
) {
  for (const folder of localFolders) {
    const folderId = await resolveFolderId(userId, folder, cloudFolderRows);
    collectSongsForFolder(userId, folderId, folder.songs, state);
  }
}

function collectSongsForFolder(
  userId: string,
  folderId: string,
  songs: StoredSong[],
  state: SongSyncState,
) {
  let nextPos = (state.maxPosByFolder.get(folderId) ?? -1) + 1;

  for (const song of dedupeSongsByArrangement(songs)) {
    const aid = resolveArrangementId(song);
    const key = songFolderKey(folderId, aid);
    const existing = state.existingByKey.get(key);

    if (syncExistingSong(state, existing, song)) continue;

    state.toInsert.push(buildStoredSongRow(userId, folderId, song, nextPos, false));
    nextPos++;
    state.existingByKey.set(key, {} as CloudSongRow);
  }
}

function syncExistingSong(
  state: SongSyncState,
  existing: CloudSongRow | undefined,
  song: StoredSong,
) {
  if (!existing) return false;
  if (existing.id) state.toUpdate.push({ id: existing.id, song });
  return true;
}

function updateStoredSongRow({ id, song }: SongUpdate) {
  const row = toneCapoUiFromStored(song);
  return db
    .update(userSongs)
    .set({
      songId: song.id,
      title: song.title,
      artist: song.artist,
      artistSlug: song.artistSlug,
      slug: song.slug,
      youtubeId: youtubeIdForRow(song),
      songData: song.songData,
      tone: row.tone,
      capo: row.capo,
      uiPrefs: row.uiPrefs,
      sourceArtistSlug: sourceArtistSlugForRow(song),
      sourceSlug: sourceSlugForRow(song),
      isRecent: false,
      updatedAt: new Date(),
    })
    .where(eq(userSongs.id, id));
}

async function mergeRecentSongs(userId: string, localRecentes: StoredSong[]) {
  const { recentes: cloudRecentes } = await loadCloudFoldersAndSongs(userId);
  const localKeys = new Set(localRecentes.map((song) => arrangementKey(song)));
  const mergedRecentes = dedupeSongsByArrangement([
    ...localRecentes,
    ...cloudRecentes.filter((song) => !localKeys.has(arrangementKey(song))),
  ]).slice(0, 15);

  await replaceRecentSongsForUser(userId, mergedRecentes);
}

async function syncUserLibrary(userId: string, body: SyncBody) {
  await ensureDefaultFolder(userId);

  const cloudFolderRows = await cloudFoldersForUser(userId);
  const songSync = createSongSyncState(await cloudSongsForUser(userId));

  await collectFolderSongs(userId, body.folders ?? [], cloudFolderRows, songSync);
  await persistSongSync(songSync);
  await mergeRecentSongs(userId, dedupeSongsByArrangement(body.recentes ?? []));
}

function cloudFoldersForUser(userId: string) {
  return db
    .select()
    .from(userFolders)
    .where(eq(userFolders.userId, userId));
}

function cloudSongsForUser(userId: string) {
  return db
    .select()
    .from(userSongs)
    .where(eq(userSongs.userId, userId));
}

async function persistSongSync(songSync: SongSyncState) {
  await Promise.all(songSync.toUpdate.map(updateStoredSongRow));
  if (songSync.toInsert.length > 0) await db.insert(userSongs).values(songSync.toInsert);
}

export async function POST(req: Request) {
  const request = await requireApiUserJson<SyncBody>(req);
  if ("response" in request) return request.response;
  await syncUserLibrary(request.userId, request.body);

  return NextResponse.json(await loadCloudFoldersAndSongs(request.userId));
}
