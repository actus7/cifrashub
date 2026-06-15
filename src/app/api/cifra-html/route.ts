import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { cachedCifras } from "@/db/schema";
import { cifraClubHeaders, readCifraSlugParams } from "@/lib/server/cifra-route";

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type CachedCifra = {
  html: string;
  updatedAt: Date;
};

function isCloudflareBlock(text: string): boolean {
  return (
    text.includes("cf-browser-verification") ||
    text.includes("Just a moment...") ||
    text.includes("Attention Required!")
  );
}

async function findCachedCifra(
  artistSlug: string,
  slug: string,
): Promise<CachedCifra | null> {
  try {
    const rows = await db
      .select({ html: cachedCifras.html, updatedAt: cachedCifras.updatedAt })
      .from(cachedCifras)
      .where(
        and(eq(cachedCifras.artistSlug, artistSlug), eq(cachedCifras.slug, slug)),
      )
      .limit(1);

    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function isCacheFresh(cached: CachedCifra): boolean {
  return Date.now() - cached.updatedAt.getTime() < CACHE_TTL_MS;
}

async function saveCachedHtml(
  artistSlug: string,
  slug: string,
  sourceUrl: string,
  html: string,
): Promise<void> {
  try {
    await db
      .insert(cachedCifras)
      .values({ artistSlug, slug, sourceUrl, html })
      .onConflictDoUpdate({
        target: [cachedCifras.artistSlug, cachedCifras.slug],
        set: { sourceUrl, html, updatedAt: new Date() },
      });
  } catch (error) {
    console.error("Failed to save cached cifra:", error);
  }
}

async function fetchCifraClubHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: cifraClubHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) return null;

    const text = await res.text();
    return isCloudflareBlock(text) ? null : text;
  } catch {
    return null;
  }
}

function cifraClubUrls(artistSlug: string, slug: string) {
  return [
    `https://www.cifraclub.com.br/${artistSlug}/${slug}/imprimir.html`,
    `https://www.cifraclub.com.br/${artistSlug}/${slug}/`,
  ];
}

async function fetchFreshCifra(artistSlug: string, slug: string) {
  for (const url of cifraClubUrls(artistSlug, slug)) {
    const html = await fetchCifraClubHtml(url);
    if (html) return { html, url };
  }
  return null;
}

function invalidParamsResponse() {
  return NextResponse.json({ html: null, error: "Parâmetros inválidos" }, { status: 400 });
}

function unavailableResponse() {
  return NextResponse.json(
    { html: null, error: "Cifra Club não retornou a cifra." },
    { status: 502 },
  );
}

function htmlResponse(html: string) {
  return NextResponse.json({ html });
}

async function freshCifraResponse(artistSlug: string, slug: string) {
  const fresh = await fetchFreshCifra(artistSlug, slug);
  if (!fresh) return null;

  await saveCachedHtml(artistSlug, slug, fresh.url, fresh.html);
  return htmlResponse(fresh.html);
}

async function cachedCifraResponse(artistSlug: string, slug: string) {
  const cached = await findCachedCifra(artistSlug, slug);
  if (shouldUseCachedCifra(cached)) return htmlResponse(cached.html);

  // A network/upstream failure must not throw away an available stale cache:
  // fall back to it instead of bubbling up a 502.
  try {
    const fresh = await freshCifraResponse(artistSlug, slug);
    if (fresh) return fresh;
  } catch (e) {
    console.error("Erro ao buscar cifra fresca, usando fallback:", e);
  }

  return fallbackCifraResponse(cached);
}

function shouldUseCachedCifra(cached: CachedCifra | null): cached is CachedCifra {
  return Boolean(cached && isCacheFresh(cached));
}

function fallbackCifraResponse(cached: CachedCifra | null) {
  return cached ? htmlResponse(cached.html) : unavailableResponse();
}

function fetchErrorResponse(e: unknown) {
  const message = e instanceof Error ? e.message : "Falha ao buscar cifra";
  return NextResponse.json({ html: null, error: message }, { status: 502 });
}

export async function GET(request: Request) {
  const params = readCifraSlugParams(request);
  if ("response" in params) return invalidParamsResponse();

  try {
    return await cachedCifraResponse(params.artistSlug, params.slug);
  } catch (e) {
    return fetchErrorResponse(e);
  }
}
