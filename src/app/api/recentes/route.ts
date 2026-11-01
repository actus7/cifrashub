import { NextResponse } from "next/server";
import type { StoredSong } from "@/lib/types";
import { requireApiUserId, requireApiUserJson } from "@/lib/server/api-route";
import { validateStoredSong } from "@/lib/server/song-validation";
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

  const validated = validateStoredSong(request.body.song);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  await touchRecentSong(request.userId, validated.song);
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

  for (const s of songs) {
    const validated = validateStoredSong(s);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const trimmed =dedupeSongsByArrangement(songs, { requireId: true }).slice(0, MAX_RECENTES);
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
