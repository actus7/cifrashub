import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSetlists } from "@/db/schema";
import { readJsonBody, requireApiUserId } from "@/lib/server/api-route";
import {
  getSetlistDetail,
  listSetlistsForUser,
} from "@/lib/server/setlist-queries";

type RouteCtx = { params: Promise<{ id: string }> };

type SetlistUpdateBody = { title?: string; description?: string | null };

type SetlistRow = typeof userSetlists.$inferSelect;

function setlistOwnerWhere(id: string, userId: string) {
  return and(eq(userSetlists.id, id), eq(userSetlists.userId, userId));
}

function nextSetlistTitle(row: SetlistRow, body: SetlistUpdateBody) {
  return body.title === undefined ? row.title : body.title.trim() || row.title;
}

function nextSetlistDescription(row: SetlistRow, body: SetlistUpdateBody) {
  return body.description === undefined ? row.description : body.description?.trim() || null;
}

function setlistUpdateValues(row: SetlistRow, body: SetlistUpdateBody) {
  return {
    title: nextSetlistTitle(row, body),
    description: nextSetlistDescription(row, body),
    updatedAt: new Date(),
  };
}

function setlistNotFound() {
  return NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  const detail = await getSetlistDetail(auth.userId, id);
  if (!detail) return setlistNotFound();
  return NextResponse.json(detail);
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  const json = await readJsonBody<SetlistUpdateBody>(req);
  if ("response" in json) return json.response;
  const body = json.body;

  const [row] = await db
    .select()
    .from(userSetlists)
    .where(setlistOwnerWhere(id, auth.userId))
    .limit(1);
  if (!row) return setlistNotFound();

  await db
    .update(userSetlists)
    .set(setlistUpdateValues(row, body))
    .where(eq(userSetlists.id, id));

  const detail = await getSetlistDetail(auth.userId, id);
  return NextResponse.json(detail);
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  await db
    .delete(userSetlists)
    .where(setlistOwnerWhere(id, auth.userId));

  const setlists = await listSetlistsForUser(auth.userId);
  return NextResponse.json({ setlists });
}
