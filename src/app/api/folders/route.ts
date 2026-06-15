import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userFolders } from "@/db/schema";
import {
  requireApiUserId,
  requireApiUserJson,
  requireTrimmedText,
} from "@/lib/server/api-route";
import { loadCloudFoldersAndSongs } from "@/lib/server/cloud-data";

export async function GET() {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const { folders } = await loadCloudFoldersAndSongs(auth.userId);
  return NextResponse.json({ folders });
}

export async function POST(req: Request) {
  const request = await requireApiUserJson<{ title?: string }>(req);
  if ("response" in request) return request.response;

  const titleResult = requireTrimmedText(request.body.title, "Título obrigatório");
  if ("response" in titleResult) return titleResult.response;
  const title = titleResult.value;

  const existing = await db
    .select()
    .from(userFolders)
    .where(eq(userFolders.userId, request.userId));

  const position =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((f) => f.position)) + 1;

  const [created] = await db
    .insert(userFolders)
    .values({
      userId: request.userId,
      title,
      position,
      isDefault: false,
    })
    .returning();

  const { folders } = await loadCloudFoldersAndSongs(request.userId);
  const folderDto = folders.find((f) => f.id === created!.id);

  return NextResponse.json({ folder: folderDto ?? null, folders });
}
