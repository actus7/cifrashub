import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ready, resetDb, seedUser, testDb } from "@/test/db-harness";

vi.mock("@/db", async () => {
  const h = await import("@/test/db-harness");
  return { db: h.testDb.db };
});

import {
  folderMembers,
  setlistMembers,
  userFolders,
  userSetlistItems,
  userSetlists,
  userSongs,
} from "@/db/schema";
import {
  canViewerReadArrangement,
  resolveFolderAccess,
  resolveSetlistAccess,
} from "../access";

const OWNER = "00000000-0000-4000-8000-000000000001";
const MEMBER = "00000000-0000-4000-8000-000000000002";
const STRANGER = "00000000-0000-4000-8000-000000000003";
const FOLDER_A = "10000000-0000-4000-8000-00000000000a";
const FOLDER_B = "10000000-0000-4000-8000-00000000000b";
const SETLIST = "setlist-1";

const { db, client } = testDb;

function song(id: string, arrangementId: string, folderId: string | null, isRecent = false) {
  return {
    id,
    userId: OWNER,
    folderId,
    songId: `s-${id}`,
    arrangementId,
    title: "T",
    artist: "A",
    artistSlug: "a",
    slug: "t",
    songData: [],
    isRecent,
  };
}

beforeAll(() => ready);

beforeEach(async () => {
  await resetDb(client);
  await seedUser(client, OWNER, "Owner Name", "owner@x.com");
  await seedUser(client, MEMBER, "Member", "member@x.com");
  await seedUser(client, STRANGER, "Stranger", "stranger@x.com");
  await db.insert(userFolders).values([
    { id: FOLDER_A, userId: OWNER, title: "A" },
    { id: FOLDER_B, userId: OWNER, title: "B" },
  ]);
  await db.insert(folderMembers).values({ folderId: FOLDER_A, userId: MEMBER });
  await db.insert(userSetlists).values({ id: SETLIST, userId: OWNER, title: "S" });
  await db.insert(setlistMembers).values({ setlistId: SETLIST, userId: MEMBER });
});

describe("resolveFolderAccess", () => {
  it("returns owner role for the folder owner", async () => {
    const r = await resolveFolderAccess(OWNER, FOLDER_A);
    expect(r.role).toBe("owner");
    expect(r.folder?.id).toBe(FOLDER_A);
  });

  it("returns member role with owner name for a member", async () => {
    const r = await resolveFolderAccess(MEMBER, FOLDER_A);
    expect(r.role).toBe("member");
    expect(r.ownerName).toBe("Owner Name");
  });

  it("returns no folder for a stranger", async () => {
    const r = await resolveFolderAccess(STRANGER, FOLDER_A);
    expect(r).toMatchObject({ role: "none", folder: null });
  });

  it("returns no folder for a member of a different folder", async () => {
    const r = await resolveFolderAccess(MEMBER, FOLDER_B);
    expect(r).toMatchObject({ role: "none", folder: null });
  });
});

describe("resolveSetlistAccess", () => {
  it("returns owner, member and none roles", async () => {
    expect((await resolveSetlistAccess(OWNER, SETLIST)).role).toBe("owner");
    expect((await resolveSetlistAccess(MEMBER, SETLIST)).role).toBe("member");
    const stranger = await resolveSetlistAccess(STRANGER, SETLIST);
    expect(stranger).toMatchObject({ role: "none", setlist: null });
  });
});

describe("canViewerReadArrangement", () => {
  beforeEach(async () => {
    await db.insert(userSongs).values([
      song("u1", "arr-a", FOLDER_A),
      song("u2", "arr-b", FOLDER_B),
      song("u3", "arr-recent", null, true),
      song("u4", "arr-setlist", FOLDER_B),
    ]);
    await db
      .insert(userSetlistItems)
      .values({ id: "i1", setlistId: SETLIST, arrangementId: "arr-setlist" });
  });

  it("allows a folder member to read a song in the shared folder", async () => {
    expect(await canViewerReadArrangement(MEMBER, OWNER, "arr-a")).toBe(true);
  });

  it("denies a folder member the owner's song in an unshared folder", async () => {
    expect(await canViewerReadArrangement(MEMBER, OWNER, "arr-b")).toBe(false);
  });

  it("denies a recent-only row", async () => {
    expect(await canViewerReadArrangement(MEMBER, OWNER, "arr-recent")).toBe(false);
  });

  it("denies a stranger everything", async () => {
    expect(await canViewerReadArrangement(STRANGER, OWNER, "arr-a")).toBe(false);
    expect(await canViewerReadArrangement(STRANGER, OWNER, "arr-setlist")).toBe(false);
  });

  it("allows a setlist member to read only arrangements in the shared setlist", async () => {
    expect(await canViewerReadArrangement(MEMBER, OWNER, "arr-setlist")).toBe(true);
    expect(await canViewerReadArrangement(MEMBER, OWNER, "arr-b")).toBe(false);
  });
});
