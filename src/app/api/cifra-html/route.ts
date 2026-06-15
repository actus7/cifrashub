import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { cachedCifras } from "@/db/schema";

const SLUG_SEGMENT_RE = /^[a-z0-9-]{1,120}$/i;
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
  } catch {
  }
}

async function fetchCifraClubHtml(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) return null;

  const text = await res.text();
  return isCloudflareBlock(text) ? null : text;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artistSlug = searchParams.get("artistSlug")?.trim() ?? "";
  const slug = searchParams.get("slug")?.trim() ?? "";

  if (!SLUG_SEGMENT_RE.test(artistSlug) || !SLUG_SEGMENT_RE.test(slug)) {
    return NextResponse.json({ html: null, error: "Parâmetros inválidos" }, { status: 400 });
  }

  const urlsToTry = [
    `https://www.cifraclub.com.br/${artistSlug}/${slug}/imprimir.html`,
    `https://www.cifraclub.com.br/${artistSlug}/${slug}/`,
  ];

  try {
    const cached = await findCachedCifra(artistSlug, slug);
    if (cached && isCacheFresh(cached)) return NextResponse.json({ html: cached.html });

    for (const url of urlsToTry) {
      const html = await fetchCifraClubHtml(url);
      if (html) {
        await saveCachedHtml(artistSlug, slug, url, html);
        return NextResponse.json({ html });
      }
    }

    if (cached) return NextResponse.json({ html: cached.html });

    return NextResponse.json(
      { html: null, error: "Cifra Club não retornou a cifra." },
      { status: 502 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao buscar cifra";
    return NextResponse.json({ html: null, error: message }, { status: 502 });
  }
}
