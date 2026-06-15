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

export async function GET(request: Request) {
  const params = readCifraSlugParams(request);
  if ("response" in params) {
    return NextResponse.json({ html: null, error: "Parâmetros inválidos" }, { status: 400 });
  }
  const { artistSlug, slug } = params;

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
