import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { folderMembers, setlistMembers, userFolders, userSetlists } from "@/db/schema";
import { requireApiUserId } from "@/lib/server/api-route";
import { getUserDisplayName } from "@/lib/server/access";

type SharedFolderRow = { id: string; title: string; ownerId: string };
type SharedSetlistRow = { id: string; title: string; description: string | null; ownerId: string };

export async function GET() {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;

  const [folderRows, setlistRows] = await Promise.all([
    sharedFolderRows(auth.userId),
    sharedSetlistRows(auth.userId),
  ]);

  const [folders, setlists] = await Promise.all([
    Promise.all(folderRows.map(decorateFolder)),
    Promise.all(setlistRows.map(decorateSetlist)),
  ]);

  return NextResponse.json({ folders, setlists });
}

function sharedFolderRows(userId: string): Promise<SharedFolderRow[]> {
  return db
    .select({ id: userFolders.id, title: userFolders.title, ownerId: userFolders.userId })
    .from(folderMembers)
    .innerJoin(userFolders, eq(userFolders.id, folderMembers.folderId))
    .where(eq(folderMembers.userId, userId));
}

function sharedSetlistRows(userId: string): Promise<SharedSetlistRow[]> {
  return db
    .select({
      id: userSetlists.id,
      title: userSetlists.title,
      description: userSetlists.description,
      ownerId: userSetlists.userId,
    })
    .from(setlistMembers)
    .innerJoin(userSetlists, eq(userSetlists.id, setlistMembers.setlistId))
    .where(eq(setlistMembers.userId, userId));
}

async function decorateFolder(row: SharedFolderRow) {
  return { id: row.id, title: row.title, ownerName: await getUserDisplayName(row.ownerId) };
}

async function decorateSetlist(row: SharedSetlistRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ownerName: await getUserDisplayName(row.ownerId),
  };
}
