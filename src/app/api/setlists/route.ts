import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSetlists } from "@/db/schema";
import {
  requireApiUserId,
  requireApiUserJson,
  requireTrimmedText,
} from "@/lib/server/api-route";
import { nextPosition } from "@/lib/server/positions";
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

  const created = await createSetlist(request.userId, title, request.body.description);
  const setlists = await listSetlistsForUser(request.userId);
  return NextResponse.json({ setlist: created, setlists });
}

async function createSetlist(userId: string, title: string, description?: string | null) {
  const [created] = await db
    .insert(userSetlists)
    .values({
      userId,
      title,
      description: description?.trim() || null,
      position: await nextSetlistPosition(userId),
    })
    .returning();

  return created;
}

async function nextSetlistPosition(userId: string) {
  const existing = await db
    .select({ position: userSetlists.position })
    .from(userSetlists)
    .where(eq(userSetlists.userId, userId));

  return nextPosition(existing);
}
