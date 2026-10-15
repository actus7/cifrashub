import { NextResponse } from "next/server";

const SLUG_SEGMENT_RE = /^[a-z0-9-]{1,120}$/i;

function slugParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() ?? "";
}

function validSlugPair(artistSlug: string, slug: string) {
  return SLUG_SEGMENT_RE.test(artistSlug) && SLUG_SEGMENT_RE.test(slug);
}

function invalidSlugParams() {
  return { response: NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 }) };
}

export function readCifraSlugParams(request: Request) {
  const { searchParams } = new URL(request.url);
  const artistSlug = slugParam(searchParams, "artistSlug");
  const slug = slugParam(searchParams, "slug");

  return validSlugPair(artistSlug, slug) ? { artistSlug, slug } : invalidSlugParams();
}

export const cifraClubHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

const UPSTREAM_TIMEOUT_MS = 15_000;

/** GET an upstream HTML page; null on network error or non-2xx status. */
export async function fetchUpstreamHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: cifraClubHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}
