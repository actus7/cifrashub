import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/api-auth";
import { assertFolderOwner } from "@/lib/server/cloud-data";

type FolderRouteCtx = { params: Promise<{ id: string }> };

export async function requireOwnedFolder(ctx: FolderRouteCtx) {
  const authResult = await requireUserId();
  if ("error" in authResult) return { response: authResult.error };

  const { id: folderId } = await ctx.params;
  const folder = await assertFolderOwner(authResult.userId, folderId);
  if (!folder) {
    return {
      response: NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 }),
    };
  }

  return { userId: authResult.userId, folderId, folder };
}
