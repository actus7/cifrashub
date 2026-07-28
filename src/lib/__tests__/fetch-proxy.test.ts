import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchChordsHtml", () => {
  it("deduplicates concurrent requests and reuses the resolved HTML", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ html: "<main>cifra</main>" }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchChordsHtml } = await import("@/lib/fetch-proxy");

    const [first, second] = await Promise.all([
      fetchChordsHtml("artista", "musica"),
      fetchChordsHtml("artista", "musica"),
    ]);
    const third = await fetchChordsHtml("artista", "musica");

    expect(first).toBe("<main>cifra</main>");
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("removes failed requests from the cache so they can be retried", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: "indisponível" }, 503))
      .mockResolvedValueOnce(jsonResponse({ html: "<main>recuperada</main>" }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchChordsHtml } = await import("@/lib/fetch-proxy");

    await expect(fetchChordsHtml("artista", "musica")).rejects.toThrow("indisponível");
    await expect(fetchChordsHtml("artista", "musica")).resolves.toBe("<main>recuperada</main>");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not share requests that have their own abort signal", async () => {
    const fetchMock = vi.fn().mockImplementation(
      () => Promise.resolve(jsonResponse({ html: "<main>cifra</main>" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchChordsHtml } = await import("@/lib/fetch-proxy");

    await fetchChordsHtml("artista", "musica", new AbortController().signal);
    await fetchChordsHtml("artista", "musica", new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
