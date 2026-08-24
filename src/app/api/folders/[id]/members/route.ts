import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { folderMembers, userFolders } from "@/db/schema";
import { requireApiUserId } from "@/lib/server/api-route";

type RouteCtx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: RouteCtx) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const { id: folderId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId")?.trim() || auth.userId;

  const [folder] = await db.select().from(userFolders).where(eq(userFolders.id, folderId)).limit(1);
  if (!folder) return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });

  const isOwner = folder.userId === auth.userId;
  const isSelfRemoval = targetUserId === auth.userId;
  if (!isOwner && !isSelfRemoval) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  await db
    .delete(folderMembers)
    .where(and(eq(folderMembers.folderId, folderId), eq(folderMembers.userId, targetUserId)));

  return NextResponse.json({ ok: true });
}
