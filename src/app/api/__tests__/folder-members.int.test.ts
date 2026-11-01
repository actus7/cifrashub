import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ready, resetDb, seedUser, setSession, testDb } from "@/test/db-harness";

vi.mock("@/db", async () => {
  const h = await import("@/test/db-harness");
  return { db: h.testDb.db };
});
vi.mock("@/lib/auth-server", async () => {
  const h = await import("@/test/db-harness");
  return { neonAuth: { getSession: async () => ({ data: h.currentSession() }) } };
});

import { folderMembers, userFolders } from "@/db/schema";
import { DELETE } from "../folders/[id]/members/route";

const OWNER = "00000000-0000-4000-8000-000000000001";
const MEMBER = "00000000-0000-4000-8000-000000000002";
const MEMBER2 = "00000000-0000-4000-8000-000000000004";
const STRANGER = "00000000-0000-4000-8000-000000000003";
const FOLDER = "10000000-0000-4000-8000-00000000000a";

const { db, client } = testDb;

const remove = (targetUserId?: string) =>
  DELETE(
    new Request(
      `http://x/api/folders/${FOLDER}/members${targetUserId ? `?userId=${targetUserId}` : ""}`,
    ),
    { params: Promise.resolve({ id: FOLDER }) },
  );

const memberIds = async () => (await db.select().from(folderMembers)).map((r) => r.userId).sort();

beforeAll(() => ready);

beforeEach(async () => {
  setSession(null);
  await resetDb(client);
  for (const [id, n] of [
    [OWNER, "o"],
    [MEMBER, "m"],
    [MEMBER2, "m2"],
    [STRANGER, "s"],
  ]) {
    await seedUser(client, id, n, `${n}@x.com`);
  }
  await db.insert(userFolders).values({ id: FOLDER, userId: OWNER, title: "A" });
  await db.insert(folderMembers).values([
    { folderId: FOLDER, userId: MEMBER },
    { folderId: FOLDER, userId: MEMBER2 },
  ]);
});

describe("DELETE /api/folders/[id]/members", () => {
  it("returns 401 without a session", async () => {
    expect((await remove(MEMBER)).status).toBe(401);
  });

  it("lets the owner remove a member", async () => {
    setSession(OWNER);
    expect((await remove(MEMBER)).status).toBe(200);
    expect(await memberIds()).toEqual([MEMBER2]);
  });

  it("lets a member remove only themselves", async () => {
    setSession(MEMBER);
    expect((await remove()).status).toBe(200);
    expect(await memberIds()).toEqual([MEMBER2]);
  });

  it("forbids a member from removing another member", async () => {
    setSession(MEMBER);
    expect((await remove(MEMBER2)).status).toBe(403);
    expect(await memberIds()).toEqual([MEMBER, MEMBER2].sort());
  });

  it("forbids a stranger from removing a member (403)", async () => {
    setSession(STRANGER);
    expect((await remove(MEMBER)).status).toBe(403);
    expect(await memberIds()).toEqual([MEMBER, MEMBER2].sort());
  });
});
