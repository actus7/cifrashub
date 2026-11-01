import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  folderMembers,
  setlistMembers,
  userFolders,
  userSetlists,
} from "@/db/schema";
import { requireApiUserJson } from "@/lib/server/api-route";
import { fetchSharePayloadByToken } from "@/lib/server/share-query";

type JoinRequestBody = { token?: string };

export async function POST(req: Request) {
  const request = await requireApiUserJson<JoinRequestBody>(req);
  if ("response" in request) return request.response;

  const token = request.body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token obrigatório" }, { status: 400 });
  }

  const payload = await fetchSharePayloadByToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 404 });
  }

  if (payload.type === "folder-invite") return joinFolder(request.userId, payload.folderId);
  if (payload.type === "setlist-invite") return joinSetlist(request.userId, payload.setlistId);
  return NextResponse.json({ error: "Este link não é um convite de acesso" }, { status: 400 });
}

async function joinFolder(userId: string, folderId: string) {
  // Never trust the invite payload's ownerId/title — re-check the live table.
  const [folder] = await db.select().from(userFolders).where(eq(userFolders.id, folderId)).limit(1);
  if (!folder) return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  if (folder.userId === userId) {
    return NextResponse.json({ resourceType: "folder", id: folder.id, alreadyOwner: true });
  }

  await db.insert(folderMembers).values({ folderId, userId }).onConflictDoNothing();
  return NextResponse.json({ resourceType: "folder", id: folder.id });
}

async function joinSetlist(userId: string, setlistId: string) {
  const [setlist] = await db.select().from(userSetlists).where(eq(userSetlists.id, setlistId)).limit(1);
  if (!setlist) return NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });
  if (setlist.userId === userId) {
    return NextResponse.json({ resourceType: "setlist", id: setlist.id, alreadyOwner: true });
  }

  await db.insert(setlistMembers).values({ setlistId, userId }).onConflictDoNothing();
  return NextResponse.json({ resourceType: "setlist", id: setlist.id });
}
