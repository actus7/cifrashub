import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userFolders, userSongs } from "@/db/schema";
import type { Folder, StoredSong } from "@/lib/types";
import { requireApiUserJson } from "@/lib/server/api-route";
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

async function resolveFolderId(
  userId: string,
  localFolder: Folder,
  cloudFolders: CloudFolderRow[],
): Promise<string> {
  const isDefaultLocal =
    localFolder.isDefault ||
    localFolder.id === "default" ||
    localFolder.title === "Favoritos";

  if (isDefaultLocal) {
    const def = cloudFolders.find((f) => f.isDefault || f.title === "Favoritos");
    if (def) return def.id;
  }

  const byName = cloudFolders.find((f) => f.title === localFolder.title);
  if (byName) return byName.id;

  const position =
    cloudFolders.length === 0
      ? 0
      : Math.max(...cloudFolders.map((f) => f.position)) + 1;

  const [created] = await db
    .insert(userFolders)
    .values({
      userId,
      title: localFolder.title,
      position,
      isDefault: isDefaultLocal,
    })
    .returning();

  cloudFolders.push(created!);
  return created!.id;
}

function createSongSyncState(allCloudSongs: CloudSongRow[]): SongSyncState {
  const state: SongSyncState = {
    existingByKey: new Map(),
    maxPosByFolder: new Map(),
    toUpdate: [],
    toInsert: [],
  };

  for (const row of allCloudSongs) {
    state.existingByKey.set(`${row.folderId ?? ""}|${row.arrangementId}`, row);
    if (row.folderId) {
      const current = state.maxPosByFolder.get(row.folderId) ?? -1;
      if (row.position > current) state.maxPosByFolder.set(row.folderId, row.position);
    }
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
    const key = `${folderId}|${aid}`;
    const existing = state.existingByKey.get(key);

    if (existing) {
      state.toUpdate.push({ id: existing.id, song });
      continue;
    }

    state.toInsert.push(buildStoredSongRow(userId, folderId, song, nextPos, false));
    nextPos++;
    state.existingByKey.set(key, {} as CloudSongRow);
  }
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

export async function POST(req: Request) {
  const request = await requireApiUserJson<SyncBody>(req);
  if ("response" in request) return request.response;
  const body = request.body;

  await ensureDefaultFolder(request.userId);

  const localFolders = body.folders ?? [];
  const localRecentes = dedupeSongsByArrangement(body.recentes ?? []);

  // 1. Carrega estado cloud em uma única query
  const cloudFolderRows = await db
    .select()
    .from(userFolders)
    .where(eq(userFolders.userId, request.userId));

  const allCloudSongs = await db
    .select()
    .from(userSongs)
    .where(eq(userSongs.userId, request.userId));

  const songSync = createSongSyncState(allCloudSongs);
  await collectFolderSongs(request.userId, localFolders, cloudFolderRows, songSync);

  await Promise.all(songSync.toUpdate.map(updateStoredSongRow));

  if (songSync.toInsert.length > 0) {
    await db.insert(userSongs).values(songSync.toInsert);
  }

  await mergeRecentSongs(request.userId, localRecentes);

  const payload = await loadCloudFoldersAndSongs(request.userId);
  return NextResponse.json(payload);
}
