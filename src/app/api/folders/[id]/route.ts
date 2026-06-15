import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userFolders } from "@/db/schema";
import { readJsonBody, requireTrimmedText } from "@/lib/server/api-route";
import { loadCloudFoldersAndSongs } from "@/lib/server/cloud-data";
import { requireOwnedFolder } from "@/lib/server/folder-route";

type RouteCtx = { params: Promise<{ id: string }> };

type OwnedFolderCtx = Awaited<ReturnType<typeof requireOwnedFolder>>;
type ResolvedFolderCtx = Exclude<OwnedFolderCtx, { response: NextResponse }>;

function folderOwnerWhere(folderCtx: ResolvedFolderCtx) {
  return and(
    eq(userFolders.id, folderCtx.folderId),
    eq(userFolders.userId, folderCtx.userId),
  );
}

async function respondWithFolders(userId: string) {
  const { folders } = await loadCloudFoldersAndSongs(userId);
  return NextResponse.json({ folders });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const folderCtx = await requireOwnedFolder(ctx);
  if ("response" in folderCtx) return folderCtx.response;

  const json = await readJsonBody<{ title?: string }>(req);
  if ("response" in json) return json.response;
  const titleResult = requireTrimmedText(json.body.title, "Título obrigatório");
  if ("response" in titleResult) return titleResult.response;
  const title = titleResult.value;

  await db
    .update(userFolders)
    .set({ title, updatedAt: new Date() })
    .where(folderOwnerWhere(folderCtx));

  return respondWithFolders(folderCtx.userId);
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const folderCtx = await requireOwnedFolder(ctx);
  if ("response" in folderCtx) return folderCtx.response;

  if (folderCtx.folder.isDefault) {
    return NextResponse.json(
      { error: "Não é possível excluir a pasta padrão" },
      { status: 400 },
    );
  }

  await db
    .delete(userFolders)
    .where(folderOwnerWhere(folderCtx));

  return respondWithFolders(folderCtx.userId);
}
