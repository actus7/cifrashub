import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ready, resetDb, seedUser, testDb } from "@/test/db-harness";

vi.mock("@/db", async () => {
  const h = await import("@/test/db-harness");
  return { db: h.testDb.db };
});

vi.mock("@/lib/auth-server", async () => {
  const h = await import("@/test/db-harness");
  return { neonAuth: { getSession: async () => ({ data: h.currentSession() }) } };
});

import { setSession } from "@/test/db-harness";
import { userEntitlements } from "@/db/schema";
import { hasActiveSubscription, requireSubscriber } from "../entitlement";

const USER = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-02T12:00:00Z");
const { db, client } = testDb;

beforeAll(() => ready);

beforeEach(async () => {
  await resetDb(client);
  await client.exec("TRUNCATE user_entitlement;");
  await seedUser(client, USER, "User", "user@x.com");
});

describe("hasActiveSubscription", () => {
  it("returns false when the user has no entitlement row", async () => {
    expect(await hasActiveSubscription(USER, NOW)).toBe(false);
  });

  it("returns true for an entitlement without expiry", async () => {
    await db.insert(userEntitlements).values({ userId: USER, activeUntil: null });
    expect(await hasActiveSubscription(USER, NOW)).toBe(true);
  });

  it("returns true before and false after active_until", async () => {
    await db.insert(userEntitlements).values({ userId: USER, activeUntil: new Date("2026-12-01T00:00:00Z") });
    expect(await hasActiveSubscription(USER, NOW)).toBe(true);
    expect(await hasActiveSubscription(USER, new Date("2026-12-02T00:00:00Z"))).toBe(false);
  });
});

describe("requireSubscriber", () => {
  it("rejects anonymous users with 401", async () => {
    setSession(null);
    const result = await requireSubscriber();
    expect("response" in result && result.response.status).toBe(401);
  });

  it("rejects signed-in users without subscription with 403", async () => {
    setSession(USER);
    const result = await requireSubscriber();
    expect("response" in result && result.response.status).toBe(403);
  });

  it("accepts active subscribers", async () => {
    setSession(USER);
    await db.insert(userEntitlements).values({ userId: USER });
    expect(await requireSubscriber()).toEqual({ userId: USER });
  });
});
