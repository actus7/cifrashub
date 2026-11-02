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

import { folderMembers, setlistMembers, shareSnapshots, shareTokens, userFolders, userSetlists } from "@/db/schema";
import { INVITE_TTL_MS, tokenExpiry } from "@/lib/server/share-expiry";
import { GET as folderGet } from "../folders/[id]/members/route";
import { DELETE as setlistDelete, GET as setlistGet } from "../setlists/[id]/members/route";
import { POST as join } from "../share/join/route";

const OWNER = "00000000-0000-4000-8000-000000000001";
const MEMBER = "00000000-0000-4000-8000-000000000002";
const STRANGER = "00000000-0000-4000-8000-000000000003";
const FOLDER = "10000000-0000-4000-8000-00000000000a";
const SETLIST = "setlist-1";

const { db, client } = testDb;
const folderCtx = { params: Promise.resolve({ id: FOLDER }) };
const setlistCtx = { params: Promise.resolve({ id: SETLIST }) };
const setlistRemove = (userId: string) =>
  setlistDelete(new Request(`http://x/api/setlists/${SETLIST}/members?userId=${userId}`), setlistCtx);

beforeAll(() => ready);

beforeEach(async () => {
  setSession(null);
  await resetDb(client);
  await client.exec("TRUNCATE share_token, share_snapshot CASCADE;");
  for (const [id, n] of [
    [OWNER, "Owner"],
    [MEMBER, "Member"],
    [STRANGER, "Stranger"],
  ]) {
    await seedUser(client, id, n, `${n}@x.com`);
  }
  await db.insert(userFolders).values({ id: FOLDER, userId: OWNER, title: "A" });
  await db.insert(userSetlists).values({ id: SETLIST, userId: OWNER, title: "S" });
  await db.insert(folderMembers).values({ folderId: FOLDER, userId: MEMBER });
  await db.insert(setlistMembers).values({ setlistId: SETLIST, userId: MEMBER });
});

describe("tokenExpiry", () => {
  it("expires invites after the TTL and leaves other shares open-ended", () => {
    expect(tokenExpiry("folder-invite", 0)?.getTime()).toBe(INVITE_TTL_MS);
    expect(tokenExpiry("setlist-invite", 0)?.getTime()).toBe(INVITE_TTL_MS);
    expect(tokenExpiry("setlist")).toBeNull();
    expect(tokenExpiry("arrangement")).toBeNull();
  });
});

describe("GET members", () => {
  it("lets the owner list folder and setlist members by name", async () => {
    setSession(OWNER);
    const f = await (await folderGet(new Request("http://x"), folderCtx)).json();
    expect(f.members).toHaveLength(1);
    expect(f.members[0]).toMatchObject({ userId: MEMBER, name: "Member" });
    const s = await (await setlistGet(new Request("http://x"), setlistCtx)).json();
    expect(s.members[0]).toMatchObject({ userId: MEMBER, name: "Member" });
    expect(JSON.stringify([f, s])).not.toContain("@x.com");
  });

  it("returns 404 to members and strangers", async () => {
    for (const who of [MEMBER, STRANGER]) {
      setSession(who);
      expect((await folderGet(new Request("http://x"), folderCtx)).status).toBe(404);
      expect((await setlistGet(new Request("http://x"), setlistCtx)).status).toBe(404);
    }
  });
});

describe("DELETE setlist member", () => {
  it("lets the owner remove a member", async () => {
    setSession(OWNER);
    expect((await setlistRemove(MEMBER)).status).toBe(200);
    expect(await db.select().from(setlistMembers)).toHaveLength(0);
  });

  it("returns 404 for a stranger and keeps the member", async () => {
    setSession(STRANGER);
    expect((await setlistRemove(MEMBER)).status).toBe(404);
    expect(await db.select().from(setlistMembers)).toHaveLength(1);
  });
});

describe("expired invite", () => {
  it("cannot be joined", async () => {
    const [snap] = await db
      .insert(shareSnapshots)
      .values({
        resourceType: "folder-invite",
        payload: { type: "folder-invite", folderId: FOLDER },
        createdByUserId: OWNER,
      })
      .returning();
    const [tok] = await db
      .insert(shareTokens)
      .values({ snapshotId: snap!.id, expiresAt: new Date(Date.now() - 1000) })
      .returning();
    setSession(STRANGER);
    const res = await join(
      new Request("http://x/api/share/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tok!.token }),
      }),
    );
    expect(res.status).toBe(404);
    expect(await db.select().from(folderMembers)).toHaveLength(1);
  });
});
