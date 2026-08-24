import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSongs } from "@/db/schema";
import { requireApiUserId } from "@/lib/server/api-route";
import { getUserDisplayName, hasAnyAccessToOwner } from "@/lib/server/access";
import { preferredArrangementRow, rowToStoredSong } from "@/lib/server/cloud-data";

export async function GET(req: Request) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId")?.trim();
  const arrangementId = searchParams.get("arrangementId")?.trim();
  if (!ownerId || !arrangementId) {
    return NextResponse.json({ error: "ownerId e arrangementId obrigatórios" }, { status: 400 });
  }

  const hasAccess = await hasAnyAccessToOwner(auth.userId, ownerId);
  if (!hasAccess) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const rows = await db
    .select()
    .from(userSongs)
    .where(and(eq(userSongs.userId, ownerId), eq(userSongs.arrangementId, arrangementId)));
  const row = preferredArrangementRow(rows);
  if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const ownerName = await getUserDisplayName(ownerId);
  return NextResponse.json({ song: rowToStoredSong(row), ownerName });
}
