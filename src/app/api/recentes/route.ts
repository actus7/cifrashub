import { NextResponse } from "next/server";
import type { StoredSong } from "@/lib/types";
import { requireApiUserId, requireApiUserJson } from "@/lib/server/api-route";
import { loadCloudFoldersAndSongs } from "@/lib/server/cloud-data";
import {
  clearRecentSongsForUser,
  dedupeSongsByArrangement,
  replaceRecentSongsForUser,
} from "@/lib/server/recent-songs";

export async function GET() {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const { recentes } = await loadCloudFoldersAndSongs(auth.userId);
  return NextResponse.json({ recentes });
}

/** Substitui a lista de recentes (até 15 itens, como no client). */
export async function POST(req: Request) {
  const request = await requireApiUserJson<{ songs?: StoredSong[] }>(req);
  if ("response" in request) return request.response;

  const songs = request.body.songs;
  if (!Array.isArray(songs)) {
    return NextResponse.json({ error: "songs deve ser array" }, { status: 400 });
  }

  const trimmed = dedupeSongsByArrangement(songs, { requireId: true }).slice(0, 15);
  await replaceRecentSongsForUser(request.userId, trimmed);

  const { recentes } = await loadCloudFoldersAndSongs(request.userId);
  return NextResponse.json({ recentes });
}

export async function DELETE() {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  await clearRecentSongsForUser(auth.userId);

  return NextResponse.json({ recentes: [] });
}
