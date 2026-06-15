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
import { nextPosition } from "@/lib/server/positions";

async function nextFolderPosition(userId: string) {
  const existing = await db
    .select()
    .from(userFolders)
    .where(eq(userFolders.userId, userId));
  return nextPosition(existing);
}

async function createFolder(userId: string, title: string) {
  const [created] = await db
    .insert(userFolders)
    .values({
      userId,
      title,
      position: await nextFolderPosition(userId),
      isDefault: false,
    })
    .returning();
  return created!;
}

async function foldersResponse(userId: string, createdId?: string) {
  const { folders } = await loadCloudFoldersAndSongs(userId);
  const folder = createdId ? (folders.find((f) => f.id === createdId) ?? null) : undefined;
  return NextResponse.json(createdId ? { folder, folders } : { folders });
}

export async function GET() {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;
  return foldersResponse(auth.userId);
}

export async function POST(req: Request) {
  const request = await requireApiUserJson<{ title?: string }>(req);
  if ("response" in request) return request.response;

  const titleResult = requireTrimmedText(request.body.title, "Título obrigatório");
  if ("response" in titleResult) return titleResult.response;

  const created = await createFolder(request.userId, titleResult.value);
  return foldersResponse(request.userId, created.id);
}
