import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { setlistMembers } from "@/db/schema";
import { requireApiUserId } from "@/lib/server/api-route";

type RouteCtx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;

  await db
    .delete(setlistMembers)
    .where(and(eq(setlistMembers.setlistId, id), eq(setlistMembers.userId, auth.userId)));

  return NextResponse.json({ ok: true });
}
