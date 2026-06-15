import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSetlists } from "@/db/schema";
import {
  requireApiUserId,
  requireApiUserJson,
  requireTrimmedText,
} from "@/lib/server/api-route";
import { listSetlistsForUser } from "@/lib/server/setlist-queries";

export async function GET() {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const list = await listSetlistsForUser(auth.userId);
  return NextResponse.json({ setlists: list });
}

export async function POST(req: Request) {
  const request = await requireApiUserJson<{ title?: string; description?: string | null }>(req);
  if ("response" in request) return request.response;

  const titleResult = requireTrimmedText(request.body.title, "title obrigatório");
  if ("response" in titleResult) return titleResult.response;
  const title = titleResult.value;

  const existing = await db
    .select()
    .from(userSetlists)
    .where(eq(userSetlists.userId, request.userId));
  const position =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((r) => r.position)) + 1;

  const [created] = await db
    .insert(userSetlists)
    .values({
      userId: request.userId,
      title,
      description: request.body.description?.trim() || null,
      position,
    })
    .returning();

  const setlists = await listSetlistsForUser(request.userId);
  return NextResponse.json({ setlist: created, setlists });
}
