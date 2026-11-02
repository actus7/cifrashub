import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { neonAuthUsers, setlistMembers, userSetlists } from "@/db/schema";
import { displayNameFromUserRow } from "@/lib/server/access";
import { requireApiUserId } from "@/lib/server/api-route";

type RouteCtx = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });

async function isSetlistOwner(setlistId: string, userId: string) {
  const [row] = await db
    .select({ userId: userSetlists.userId })
    .from(userSetlists)
    .where(eq(userSetlists.id, setlistId))
    .limit(1);
  return row?.userId === userId;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  if (!(await isSetlistOwner(id, auth.userId))) return notFound();

  const rows = await db
    .select({ userId: setlistMembers.userId, joinedAt: setlistMembers.createdAt, name: neonAuthUsers.name })
    .from(setlistMembers)
    .leftJoin(neonAuthUsers, eq(neonAuthUsers.id, setlistMembers.userId))
    .where(eq(setlistMembers.setlistId, id));

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

  const { id } = await ctx.params;
  if (!(await isSetlistOwner(id, auth.userId))) return notFound();

  const targetUserId = new URL(req.url).searchParams.get("userId")?.trim();
  if (!targetUserId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 });

  await db
    .delete(setlistMembers)
    .where(and(eq(setlistMembers.setlistId, id), eq(setlistMembers.userId, targetUserId)));
  return NextResponse.json({ ok: true });
}
