import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSongs } from "@/db/schema";
import type { StoredSong } from "@/lib/types";
import { readJsonBody } from "@/lib/server/api-route";
import { loadCloudFoldersAndSongs } from "@/lib/server/cloud-data";
import { requireOwnedFolder } from "@/lib/server/folder-route";
import { nextPosition } from "@/lib/server/positions";
import { buildStoredSongRow } from "@/lib/server/stored-song-row";

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

async function nextFolderSongPosition(folderCtx: ResolvedFolderCtx) {
  const rows = await db
    .select({ position: userSongs.position })
    .from(userSongs)
    .where(and(eq(userSongs.userId, folderCtx.userId), eq(userSongs.folderId, folderCtx.folderId)));

  return nextPosition(rows);
}

function hasStoredSongIdentity(song: StoredSong) {
  return Boolean(song.id && song.title);
}

function hasStoredSongContent(song: StoredSong) {
  return Boolean(song.songData && Array.isArray(song.songData));
}

function isValidStoredSong(song: StoredSong | null | undefined): song is StoredSong {
  if (!song) return false;
  return hasStoredSongIdentity(song) && hasStoredSongContent(song);
}

/**
 * Upsert atômico: um SELECT-depois-INSERT/UPDATE deixava uma janela onde duas
 * gravações concorrentes da mesma música na mesma pasta (dois cliques, duas
 * abas) podiam colidir na unique constraint (user_id, folder_id, arrangement_id).
 */
async function upsertFolderSong(folderCtx: ResolvedFolderCtx, song: StoredSong) {
  const position = await nextFolderSongPosition(folderCtx);
  const row = buildStoredSongRow(folderCtx.userId, folderCtx.folderId, song, position, false);

  await db
    .insert(userSongs)
    .values(row)
    .onConflictDoUpdate({
      target: [userSongs.userId, userSongs.folderId, userSongs.arrangementId],
      targetWhere: sql`${userSongs.folderId} is not null`,
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
        isRecent: false,
        updatedAt: new Date(),
      },
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

  if (!isValidStoredSong(body)) {
    return NextResponse.json({ error: "Dados da música inválidos" }, { status: 400 });
  }

  await upsertFolderSong(folderCtx, body);
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
