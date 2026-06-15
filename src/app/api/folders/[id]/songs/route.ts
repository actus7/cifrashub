import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSongs } from "@/db/schema";
import type { StoredSong } from "@/lib/types";
import { readJsonBody } from "@/lib/server/api-route";
import { loadCloudFoldersAndSongs } from "@/lib/server/cloud-data";
import { requireOwnedFolder } from "@/lib/server/folder-route";
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

type RouteCtx = { params: Promise<{ id: string }> };
type OwnedFolderCtx = Awaited<ReturnType<typeof requireOwnedFolder>>;
type ResolvedFolderCtx = Exclude<OwnedFolderCtx, { response: NextResponse }>;

function folderSongWhere(folderCtx: ResolvedFolderCtx, arrangementId: string) {
  return and(
    eq(userSongs.userId, folderCtx.userId),
    eq(userSongs.folderId, folderCtx.folderId),
    eq(userSongs.arrangementId, arrangementId),
  );
}

async function respondWithFolders(userId: string) {
  const { folders } = await loadCloudFoldersAndSongs(userId);
  return NextResponse.json({ folders });
}

async function existingSongId(folderCtx: ResolvedFolderCtx, arrangementId: string) {
  const existing = await db
    .select({ id: userSongs.id })
    .from(userSongs)
    .where(folderSongWhere(folderCtx, arrangementId))
    .limit(1);

  return existing[0]?.id ?? null;
}

async function nextFolderSongPosition(folderCtx: ResolvedFolderCtx) {
  const rows = await db
    .select({ position: userSongs.position })
    .from(userSongs)
    .where(and(eq(userSongs.userId, folderCtx.userId), eq(userSongs.folderId, folderCtx.folderId)));

  return rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.position)) + 1;
}

async function updateFolderSong(id: string, song: StoredSong) {
  const rowSong = toneCapoUiFromStored(song);

  await db
    .update(userSongs)
    .set({
      songId: song.id,
      title: song.title,
      artist: song.artist,
      artistSlug: song.artistSlug,
      slug: song.slug,
      youtubeId: youtubeIdForRow(song),
      songData: song.songData,
      tone: rowSong.tone,
      capo: rowSong.capo,
      uiPrefs: rowSong.uiPrefs,
      sourceArtistSlug: sourceArtistSlugForRow(song),
      sourceSlug: sourceSlugForRow(song),
      isRecent: false,
      updatedAt: new Date(),
    })
    .where(eq(userSongs.id, id));
}

async function insertFolderSong(folderCtx: ResolvedFolderCtx, song: StoredSong) {
  const position = await nextFolderSongPosition(folderCtx);
  await db.insert(userSongs).values({
    ...buildStoredSongRow(folderCtx.userId, folderCtx.folderId, song, position, false),
  });
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const folderCtx = await requireOwnedFolder(ctx);
  if ("response" in folderCtx) return folderCtx.response;

  const { folders } = await loadCloudFoldersAndSongs(folderCtx.userId);
  const f = folders.find((x) => x.id === folderCtx.folderId);
  return NextResponse.json({ songs: f?.songs ?? [] });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const folderCtx = await requireOwnedFolder(ctx);
  if ("response" in folderCtx) return folderCtx.response;

  const json = await readJsonBody<StoredSong>(req);
  if ("response" in json) return json.response;
  const body = json.body;

  if (
    !body?.id ||
    !body.title ||
    !body.songData ||
    !Array.isArray(body.songData)
  ) {
    return NextResponse.json({ error: "Dados da música inválidos" }, { status: 400 });
  }

  const existingId = await existingSongId(folderCtx, resolveArrangementId(body));

  if (existingId) {
    await updateFolderSong(existingId, body);
  } else {
    await insertFolderSong(folderCtx, body);
  }

  return respondWithFolders(folderCtx.userId);
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const folderCtx = await requireOwnedFolder(ctx);
  if ("response" in folderCtx) return folderCtx.response;

  const { searchParams } = new URL(req.url);
  const arrangementId =
    searchParams.get("arrangementId") ?? searchParams.get("songId");
  if (!arrangementId) {
    return NextResponse.json(
      { error: "arrangementId obrigatório" },
      { status: 400 },
    );
  }

  await db.delete(userSongs).where(folderSongWhere(folderCtx, arrangementId));

  return respondWithFolders(folderCtx.userId);
}
