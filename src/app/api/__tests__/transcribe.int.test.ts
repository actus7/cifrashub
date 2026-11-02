import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ready, resetDb, seedUser, setSession, testDb } from "@/test/db-harness";

vi.mock("@/db", async () => {
  const h = await import("@/test/db-harness");
  return { db: h.testDb.db };
});
vi.mock("@/lib/auth-server", async () => {
  const h = await import("@/test/db-harness");
  return { neonAuth: { getSession: async () => ({ data: h.currentSession() }) } };
});

import { userEntitlements } from "@/db/schema";
import { GET, POST } from "../song/transcribe/route";

const USER = "00000000-0000-4000-8000-000000000001";
const { db, client } = testDb;

function upload(bytes = 2_000) {
  const form = new FormData();
  form.set("audio", new Blob([new Uint8Array(bytes)], { type: "audio/webm" }), "a.webm");
  form.set("prompt", "Ei, meu coração");
  return POST(new Request("http://x/api/song/transcribe", { method: "POST", body: form }));
}

beforeAll(() => ready);
beforeEach(async () => {
  await resetDb(client);
  await client.exec("TRUNCATE user_entitlement;");
  await seedUser(client, USER, "U", "u@x.com");
  vi.stubEnv("GROQ_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/song/transcribe", () => {
  it("reports Whisper as available only to subscribers when the key is set", async () => {
    setSession(null);
    expect((await GET()).status).toBe(401);
    setSession(USER);
    vi.stubEnv("GROQ_API_KEY", "test-key");
    expect(await (await GET()).json()).toEqual({ available: false });
    await db.insert(userEntitlements).values({ userId: USER });
    expect(await (await GET()).json()).toEqual({ available: true });
  });

  it("requires a subscription and a configured key", async () => {
    setSession(USER);
    expect((await upload()).status).toBe(403);
    await db.insert(userEntitlements).values({ userId: USER });
    expect((await upload()).status).toBe(503);
  });

  it("forwards the audio with the lyrics as prompt and returns the text", async () => {
    setSession(USER);
    await db.insert(userEntitlements).values({ userId: USER });
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ text: " ei meu coração " })));
    const res = await upload();
    expect(await res.json()).toEqual({ text: "ei meu coração" });
    const sent = fetchMock.mock.calls[0][1]!.body as FormData;
    expect(sent.get("prompt")).toBe("Ei, meu coração");
    expect(sent.get("language")).toBe("pt");
  });

  it("rejects oversized audio", async () => {
    setSession(USER);
    await db.insert(userEntitlements).values({ userId: USER });
    vi.stubEnv("GROQ_API_KEY", "test-key");
    expect((await upload(1_500_000)).status).toBe(400);
  });
});
