import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { folderMembers, neonAuthUsers, userFolders } from "@/db/schema";
import { displayNameFromUserRow } from "@/lib/server/access";
import { requireApiUserId } from "@/lib/server/api-route";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const { id: folderId } = await ctx.params;
  const [folder] = await db.select().from(userFolders).where(eq(userFolders.id, folderId)).limit(1);
  if (!folder || folder.userId !== auth.userId) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  }

  const rows = await db
    .select({ userId: folderMembers.userId, joinedAt: folderMembers.createdAt, name: neonAuthUsers.name })
    .from(folderMembers)
    .leftJoin(neonAuthUsers, eq(neonAuthUsers.id, folderMembers.userId))
    .where(eq(folderMembers.folderId, folderId));

  return NextResponse.json({
    members: rows.map((r) => ({
      userId: r.userId,
      name: displayNameFromUserRow({ name: r.name, email: null }),
      joinedAt: r.joinedAt,
    })),
  });
}

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
