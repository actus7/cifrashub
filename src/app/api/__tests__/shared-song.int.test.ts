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

import { folderMembers, userFolders, userSongs } from "@/db/schema";
import { GET } from "../shared/song/route";

const OWNER = "00000000-0000-4000-8000-000000000001";
const MEMBER = "00000000-0000-4000-8000-000000000002";
const STRANGER = "00000000-0000-4000-8000-000000000003";
const FOLDER_A = "10000000-0000-4000-8000-00000000000a";
const FOLDER_B = "10000000-0000-4000-8000-00000000000b";

const { db, client } = testDb;

const call = (arrangementId: string) =>
  GET(new Request(`http://x/api/shared/song?ownerId=${OWNER}&arrangementId=${arrangementId}`));

beforeAll(() => ready);

beforeEach(async () => {
  setSession(null);
  await resetDb(client);
  await seedUser(client, OWNER, "Owner Name", "owner@x.com");
  await seedUser(client, MEMBER, "Member", "member@x.com");
  await seedUser(client, STRANGER, "Stranger", "stranger@x.com");
  await db.insert(userFolders).values([
    { id: FOLDER_A, userId: OWNER, title: "A" },
    { id: FOLDER_B, userId: OWNER, title: "B" },
  ]);
  await db.insert(folderMembers).values({ folderId: FOLDER_A, userId: MEMBER });
  const base = { userId: OWNER, title: "T", artist: "A", artistSlug: "a", slug: "t", songData: [] };
  await db.insert(userSongs).values([
    { ...base, id: "u1", folderId: FOLDER_A, songId: "s1", arrangementId: "arr-a" },
    { ...base, id: "u2", folderId: FOLDER_B, songId: "s2", arrangementId: "arr-b" },
  ]);
});

describe("GET /api/shared/song", () => {
  it("returns 401 without a session", async () => {
    expect((await call("arr-a")).status).toBe(401);
  });

  it("returns 404 for a stranger", async () => {
    setSession(STRANGER);
    expect((await call("arr-a")).status).toBe(404);
  });

  it("returns 404 for a member requesting an unshared song", async () => {
    setSession(MEMBER);
    expect((await call("arr-b")).status).toBe(404);
  });

  it("returns 200 with the song and owner name for a shared song", async () => {
    setSession(MEMBER);
    const res = await call("arr-a");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.song.arrangementId).toBe("arr-a");
    expect(json.ownerName).toBe("Owner Name");
  });
});
