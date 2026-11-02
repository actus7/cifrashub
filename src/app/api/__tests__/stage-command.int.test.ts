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
const askJev = vi.fn();
vi.mock("@/lib/server/jev", () => ({ askJev: (...args: unknown[]) => askJev(...args) }));

import { setlistMembers, userEntitlements, userSetlists } from "@/db/schema";
import { POST } from "../setlists/[id]/stage/command/route";

const OWNER = "00000000-0000-4000-8000-000000000001";
const MEMBER = "00000000-0000-4000-8000-000000000002";
const SETLIST = "setlist-1";
const ctx = { params: Promise.resolve({ id: SETLIST }) };
const { db, client } = testDb;
const post = (phrase: string) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify({ phrase }) }), ctx);

beforeAll(() => ready);

beforeEach(async () => {
  askJev.mockReset();
  await resetDb(client);
  await client.exec("TRUNCATE user_entitlement;");
  await seedUser(client, OWNER, "Owner", "o@x.com");
  await seedUser(client, MEMBER, "Member", "m@x.com");
  await db.insert(userSetlists).values({ id: SETLIST, userId: OWNER, title: "Show" });
  await db.insert(setlistMembers).values({ setlistId: SETLIST, userId: MEMBER });
});

describe("POST /api/setlists/[id]/stage/command", () => {
  it("rejects members and owners without subscription without calling Jev", async () => {
    setSession(MEMBER);
    expect((await post("próxima")).status).toBe(403);
    setSession(OWNER);
    expect((await post("próxima")).status).toBe(403);
    expect(askJev).not.toHaveBeenCalled();
  });

  it("returns the command for a confident answer", async () => {
    await db.insert(userEntitlements).values({ userId: OWNER });
    askJev.mockResolvedValue({
      comando: { type: "choice", choice: "subir_tom", confidence: 0.9, probabilities: { subir_tom: 0.97, nenhum: 0.03 } },
    });
    setSession(OWNER);
    const res = await post("sobe meio tom");
    expect(res.status).toBe(200);
    expect((await res.json()).command).toEqual({ type: "tone_up" });
  });
});
