const LOAD_ERROR = "Não foi possível carregar a cifra no momento.";

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

function assertCifraHtml(data: CifraHtmlResponse) {
  if (!data.html) throw new Error(data.error ?? LOAD_ERROR);
  return data.html;
}

export async function fetchChordsHtml(
  artistSlug: string,
  slug: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(cifraHtmlUrl(artistSlug, slug), { signal });
  const data = await readCifraResponse(res);

  if (!res.ok) throw new Error(data.error ?? LOAD_ERROR);
  return assertCifraHtml(data);
}
