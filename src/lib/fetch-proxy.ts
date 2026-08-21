const LOAD_ERROR = "Não foi possível carregar a cifra no momento.";
const MAX_HTML_CACHE = 100;
const htmlCache = new Map<string, Promise<string>>();

type CifraHtmlResponse = { html?: string | null; error?: string };

async function readCifraResponse(res: Response): Promise<CifraHtmlResponse> {
  try {
    return (await res.json()) as CifraHtmlResponse;
  } catch {
    return {};
  }
}

function cifraHtmlUrl(artistSlug: string, slug: string) {
  const params = new URLSearchParams({ artistSlug, slug });
  return `/api/cifra-html?${params}`;
}

function cifraHtmlFreshUrl(artistSlug: string, slug: string) {
  const params = new URLSearchParams({ artistSlug, slug, source: "fresh" });
  return `/api/cifra-html?${params}`;
}

function assertCifraHtml(data: CifraHtmlResponse) {
  if (!data.html) throw new Error(data.error ?? LOAD_ERROR);
  return data.html;
}

function cacheKey(artistSlug: string, slug: string) {
  return `${artistSlug}/${slug}`;
}

function rememberHtml(key: string, promise: Promise<string>) {
  if (htmlCache.size >= MAX_HTML_CACHE) htmlCache.delete(htmlCache.keys().next().value!);
  htmlCache.set(key, promise);
  promise.catch(() => htmlCache.delete(key));
  return promise;
}

async function fetchFreshChordsHtml(
  artistSlug: string,
  slug: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(cifraHtmlUrl(artistSlug, slug), { signal });
  const data = await readCifraResponse(res);

  if (!res.ok) throw new Error(data.error ?? LOAD_ERROR);
  return assertCifraHtml(data);
}

export async function fetchChordsHtml(
  artistSlug: string,
  slug: string,
  signal?: AbortSignal,
): Promise<string> {
  if (signal) return fetchFreshChordsHtml(artistSlug, slug, signal);

  const key = cacheKey(artistSlug, slug);
  return htmlCache.get(key) ?? rememberHtml(key, fetchFreshChordsHtml(artistSlug, slug));
}

export async function fetchChordsHtmlFresh(
  artistSlug: string,
  slug: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(cifraHtmlFreshUrl(artistSlug, slug), { signal });
  const data = await readCifraResponse(res);

  if (!res.ok) throw new Error(data.error ?? LOAD_ERROR);
  const html = assertCifraHtml(data);

  const key = cacheKey(artistSlug, slug);
  rememberHtml(key, Promise.resolve(html));

  return html;
}

export function clearChordsHtml(artistSlug: string, slug: string): void {
  htmlCache.delete(cacheKey(artistSlug, slug));
}

export async function invalidateServerCifraCache(
  artistSlug: string,
  slug: string,
): Promise<void> {
  const res = await fetch(cifraHtmlUrl(artistSlug, slug), { method: "DELETE" });
  if (!res.ok) {
    let message = "Falha ao limpar cache do servidor";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }
}
