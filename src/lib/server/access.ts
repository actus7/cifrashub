import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  folderMembers,
  neonAuthUsers,
  setlistMembers,
  userFolders,
  userSetlistItems,
  userSetlists,
  userSongs,
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

// Never fall back to the e-mail: names end up in public invite links.
export function displayNameFromUserRow(
  row: { name: string | null; email: string | null } | undefined,
): string | null {
  return row?.name?.trim() || null;
}

async function lookupUserName(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: neonAuthUsers.name, email: neonAuthUsers.email })
    .from(neonAuthUsers)
    .where(eq(neonAuthUsers.id, userId))
    .limit(1);
  return displayNameFromUserRow(row);
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

/** True only if the arrangement sits inside a folder or setlist of `ownerId` shared with `viewerId`. */
export async function canViewerReadArrangement(
  viewerId: string,
  ownerId: string,
  arrangementId: string,
): Promise<boolean> {
  const [viaFolder, viaSetlist] = await Promise.all([
    db
      .select({ id: userSongs.id })
      .from(userSongs)
      .innerJoin(folderMembers, eq(folderMembers.folderId, userSongs.folderId))
      .where(
        and(
          eq(userSongs.userId, ownerId),
          eq(userSongs.arrangementId, arrangementId),
          eq(folderMembers.userId, viewerId),
        ),
      )
      .limit(1),
    db
      .select({ id: userSetlistItems.id })
      .from(userSetlistItems)
      .innerJoin(userSetlists, eq(userSetlists.id, userSetlistItems.setlistId))
      .innerJoin(setlistMembers, eq(setlistMembers.setlistId, userSetlists.id))
      .where(
        and(
          eq(userSetlistItems.arrangementId, arrangementId),
          eq(userSetlists.userId, ownerId),
          eq(setlistMembers.userId, viewerId),
        ),
      )
      .limit(1),
  ]);
  return viaFolder.length > 0 || viaSetlist.length > 0;
}
