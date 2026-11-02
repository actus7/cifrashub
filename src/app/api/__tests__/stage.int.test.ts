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

import { setlistMembers, userEntitlements, userSetlists } from "@/db/schema";
import { GET, PUT } from "../setlists/[id]/stage/route";

const OWNER = "00000000-0000-4000-8000-000000000001";
const MEMBER = "00000000-0000-4000-8000-000000000002";
const STRANGER = "00000000-0000-4000-8000-000000000003";
const SETLIST = "setlist-1";
const ctx = { params: Promise.resolve({ id: SETLIST }) };
const { db, client } = testDb;

const STATE = { position: 2, lineIndex: 5, transpose: -2, active: true };
const put = (body: unknown) =>
  PUT(new Request(`http://x/api/setlists/${SETLIST}/stage`, { method: "PUT", body: JSON.stringify(body) }), ctx);
const get = () => GET(new Request(`http://x/api/setlists/${SETLIST}/stage`), ctx);

beforeAll(() => ready);

beforeEach(async () => {
  setSession(null);
  await resetDb(client);
  await client.exec("TRUNCATE user_entitlement;");
  await seedUser(client, OWNER, "Owner", "o@x.com");
  await seedUser(client, MEMBER, "Member", "m@x.com");
  await seedUser(client, STRANGER, "Stranger", "s@x.com");
  await db.insert(userSetlists).values({ id: SETLIST, userId: OWNER, title: "Show" });
  await db.insert(setlistMembers).values({ setlistId: SETLIST, userId: MEMBER });
});

describe("PUT /api/setlists/[id]/stage", () => {
  it("lets any owner run the stage (no AI cost, no subscription needed)", async () => {
    setSession(OWNER);
    expect((await put(STATE)).status).toBe(200);
  });

  it("rejects members even when they subscribe", async () => {
    await db.insert(userEntitlements).values({ userId: MEMBER });
    setSession(MEMBER);
    expect((await put(STATE)).status).toBe(403);
  });

  it("rejects strangers with 404 and invalid bodies with 400", async () => {
    await db.insert(userEntitlements).values([{ userId: OWNER }, { userId: STRANGER }]);
    setSession(STRANGER);
    expect((await put(STATE)).status).toBe(404);
    setSession(OWNER);
    expect((await put({ ...STATE, transpose: 99 })).status).toBe(400);
  });

  it("lets the subscribed owner publish and members read it", async () => {
    await db.insert(userEntitlements).values({ userId: OWNER });
    setSession(OWNER);
    expect((await put(STATE)).status).toBe(200);
    expect((await put({ ...STATE, lineIndex: 6 })).status).toBe(200);

    setSession(MEMBER);
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewerRole).toBe("member");
    expect(body.ownerName).toBe("Owner");
    expect(body.stage).toMatchObject({ ...STATE, lineIndex: 6 });
  });
});

describe("GET /api/setlists/[id]/stage", () => {
  it("hides the stage from strangers", async () => {
    setSession(STRANGER);
    expect((await get()).status).toBe(404);
  });

  it("returns null stage before the show starts", async () => {
    setSession(OWNER);
    const body = await (await get()).json();
    expect(body).toMatchObject({ stage: null, viewerRole: "owner" });
  });
});
