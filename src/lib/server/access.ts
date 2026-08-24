import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  folderMembers,
  neonAuthUsers,
  setlistMembers,
  userFolders,
  userSetlists,
} from "@/db/schema";

export type ResourceRole = "owner" | "member" | "none";

export type FolderAccess = {
  role: ResourceRole;
  ownerId: string | null;
  ownerName: string | null;
  folder: typeof userFolders.$inferSelect | null;
};

export type SetlistAccess = {
  role: ResourceRole;
  ownerId: string | null;
  ownerName: string | null;
  setlist: typeof userSetlists.$inferSelect | null;
};

const noAccess = { role: "none" as const, ownerId: null, ownerName: null };

export async function getUserDisplayName(userId: string): Promise<string | null> {
  return lookupUserName(userId);
}

async function lookupUserName(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: neonAuthUsers.name, email: neonAuthUsers.email })
    .from(neonAuthUsers)
    .where(eq(neonAuthUsers.id, userId))
    .limit(1);
  return row?.name ?? row?.email ?? null;
}

export async function resolveFolderAccess(
  viewerId: string,
  folderId: string,
): Promise<FolderAccess> {
  const [folder] = await db
    .select()
    .from(userFolders)
    .where(eq(userFolders.id, folderId))
    .limit(1);
  if (!folder) return { ...noAccess, folder: null };
  if (folder.userId === viewerId) {
    return { role: "owner", ownerId: folder.userId, ownerName: null, folder };
  }

  const [membership] = await db
    .select({ userId: folderMembers.userId })
    .from(folderMembers)
    .where(and(eq(folderMembers.folderId, folderId), eq(folderMembers.userId, viewerId)))
    .limit(1);
  if (!membership) return { ...noAccess, folder: null };

  const ownerName = await lookupUserName(folder.userId);
  return { role: "member", ownerId: folder.userId, ownerName, folder };
}

export async function resolveSetlistAccess(
  viewerId: string,
  setlistId: string,
): Promise<SetlistAccess> {
  const [setlist] = await db
    .select()
    .from(userSetlists)
    .where(eq(userSetlists.id, setlistId))
    .limit(1);
  if (!setlist) return { ...noAccess, setlist: null };
  if (setlist.userId === viewerId) {
    return { role: "owner", ownerId: setlist.userId, ownerName: null, setlist };
  }

  const [membership] = await db
    .select({ userId: setlistMembers.userId })
    .from(setlistMembers)
    .where(and(eq(setlistMembers.setlistId, setlistId), eq(setlistMembers.userId, viewerId)))
    .limit(1);
  if (!membership) return { ...noAccess, setlist: null };

  const ownerName = await lookupUserName(setlist.userId);
  return { role: "member", ownerId: setlist.userId, ownerName, setlist };
}

export async function hasAnyAccessToOwner(viewerId: string, ownerId: string): Promise<boolean> {
  const [folderRow] = await db
    .select({ id: folderMembers.folderId })
    .from(folderMembers)
    .innerJoin(userFolders, eq(userFolders.id, folderMembers.folderId))
    .where(and(eq(folderMembers.userId, viewerId), eq(userFolders.userId, ownerId)))
    .limit(1);
  if (folderRow) return true;

  const [setlistRow] = await db
    .select({ id: setlistMembers.setlistId })
    .from(setlistMembers)
    .innerJoin(userSetlists, eq(userSetlists.id, setlistMembers.setlistId))
    .where(and(eq(setlistMembers.userId, viewerId), eq(userSetlists.userId, ownerId)))
    .limit(1);
  return Boolean(setlistRow);
}
