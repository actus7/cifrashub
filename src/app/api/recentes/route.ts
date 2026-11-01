import { NextResponse } from "next/server";
import type { StoredSong } from "@/lib/types";
import { requireApiUserId, requireApiUserJson } from "@/lib/server/api-route";
import {
  MAX_RECENTES,
  clearRecentSongsForUser,
  dedupeSongsByArrangement,
  loadRecentSongs,
  removeRecentSong,
  replaceRecentSongsForUser,
  touchRecentSong,
} from "@/lib/server/recent-songs";

export async function GET() {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  return NextResponse.json({ recentes: await loadRecentSongs(auth.userId) });
}

/** Abre uma música: move/insere uma única linha no topo dos recentes. */
export async function PUT(req: Request) {
  const request = await requireApiUserJson<{ song?: StoredSong }>(req);
  if ("response" in request) return request.response;

  const song = request.body.song;
  if (!song || typeof song !== "object" || !song.id) {
    return NextResponse.json({ error: "song inválida" }, { status: 400 });
  }

  await touchRecentSong(request.userId, song);
  return NextResponse.json({ recentes: await loadRecentSongs(request.userId) });
}

/**
 * Substitui a lista de recentes.
 * @deprecated use PUT (touch)
 */
export async function POST(req: Request) {
  const request = await requireApiUserJson<{ songs?: StoredSong[] }>(req);
  if ("response" in request) return request.response;

  const songs = request.body.songs;
  if (!Array.isArray(songs)) {
    return NextResponse.json({ error: "songs deve ser array" }, { status: 400 });
  }

  const trimmed = dedupeSongsByArrangement(songs, { requireId: true }).slice(0, MAX_RECENTES);
  await replaceRecentSongsForUser(request.userId, trimmed);

  return NextResponse.json({ recentes: await loadRecentSongs(request.userId) });
}

/** `?arrangementId=` remove um recente; sem query limpa todos. */
export async function DELETE(req: Request) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const arrangementId = new URL(req.url).searchParams.get("arrangementId");
  if (arrangementId) {
    await removeRecentSong(auth.userId, arrangementId);
    return NextResponse.json({ recentes: await loadRecentSongs(auth.userId) });
  }

  await clearRecentSongsForUser(auth.userId);

  return NextResponse.json({ recentes: [] });
}
