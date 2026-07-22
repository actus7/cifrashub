import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudFetchLibrary } from "@/lib/cloud-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cloudFetchLibrary", () => {
  it("loads folders and recent songs in one sync request", async () => {
    const payload = { folders: [], recentes: [] };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(cloudFetchLibrary()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sync",
      expect.objectContaining({ cache: "no-store", credentials: "include" }),
    );
  });
});
