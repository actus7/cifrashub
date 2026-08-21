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

describe("fetchChordsHtmlFresh", () => {
  it("bypasses in-memory cache and fetches from source=fresh endpoint", async () => {
    const fetchMock = vi.fn().mockImplementation(
      () => Promise.resolve(jsonResponse({ html: "<main>fresca</main>" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchChordsHtml, fetchChordsHtmlFresh } = await import("@/lib/fetch-proxy");

    // Prime the normal cache first.
    await fetchChordsHtml("artista", "musica");
    expect(fetchMock).toHaveBeenCalledOnce();

    // Fresh fetch should hit the network again (source=fresh).
    const fresh = await fetchChordsHtmlFresh("artista", "musica");
    expect(fresh).toBe("<main>fresca</main>");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The second call URL should include source=fresh.
    const freshCallUrl = fetchMock.mock.calls[1]![0] as string;
    expect(freshCallUrl).toContain("source=fresh");
  });

  it("updates the in-memory cache so subsequent normal fetches reuse the fresh result", async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(jsonResponse({ html: callCount === 1 ? "<main>cached</main>" : "<main>fresh</main>" }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { fetchChordsHtml, fetchChordsHtmlFresh } = await import("@/lib/fetch-proxy");

    await fetchChordsHtml("artista", "musica");
    await fetchChordsHtmlFresh("artista", "musica");

    // Third call should come from the in-memory cache (no extra fetch).
    const third = await fetchChordsHtml("artista", "musica");
    expect(third).toBe("<main>fresh</main>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on non-ok response", async () => {
    const fetchMock = vi.fn().mockImplementation(
      () => Promise.resolve(jsonResponse({ error: "erro" }, 502)),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchChordsHtmlFresh } = await import("@/lib/fetch-proxy");

    await expect(fetchChordsHtmlFresh("artista", "musica")).rejects.toThrow("erro");
  });
});

describe("clearChordsHtml", () => {
  it("removes the cached entry so the next fetch hits the network", async () => {
    const fetchMock = vi.fn().mockImplementation(
      () => Promise.resolve(jsonResponse({ html: "<main>cifra</main>" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchChordsHtml, clearChordsHtml } = await import("@/lib/fetch-proxy");

    await fetchChordsHtml("artista", "musica");
    expect(fetchMock).toHaveBeenCalledOnce();

    clearChordsHtml("artista", "musica");

    await fetchChordsHtml("artista", "musica");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("invalidateServerCifraCache", () => {
  it("sends a DELETE request to the cifra-html endpoint", async () => {
    const fetchMock = vi.fn().mockImplementation(
      () => Promise.resolve(jsonResponse({ ok: true, deleted: true })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { invalidateServerCifraCache } = await import("@/lib/fetch-proxy");

    await invalidateServerCifraCache("artista", "musica");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/api/cifra-html?");
    expect(url).toContain("artistSlug=artista");
    expect(url).toContain("slug=musica");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws with server error message on non-ok response", async () => {
    const fetchMock = vi.fn().mockImplementation(
      () => Promise.resolve(jsonResponse({ error: "Erro do servidor" }, 500)),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { invalidateServerCifraCache } = await import("@/lib/fetch-proxy");

    await expect(invalidateServerCifraCache("artista", "musica")).rejects.toThrow("Erro do servidor");
  });

  it("throws with fallback message when response has no error field", async () => {
    const fetchMock = vi.fn().mockImplementation(
      () => Promise.resolve(jsonResponse({}, 500)),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { invalidateServerCifraCache } = await import("@/lib/fetch-proxy");

    await expect(invalidateServerCifraCache("artista", "musica")).rejects.toThrow("Falha ao limpar cache do servidor");
  });
});
