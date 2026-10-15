import { fetchUpstreamHtml } from "./cifra-route";
import { fetchUltimateGuitarCifra } from "./ultimate-guitar";

export type CifraSourceResult = { html: string; url: string };

// Akamai ("Access Denied") and Cloudflare challenge pages come back as 200/403 HTML
// without the chord sheet; treat them as a miss so the next source is tried.
const BLOCK_MARKERS = [
  "cf-browser-verification",
  "Just a moment...",
  "Attention Required!",
  "<TITLE>Access Denied</TITLE>",
];

export function isUsableCifraHtml(html: string): boolean {
  return /<pre[\s>]/i.test(html) && !BLOCK_MARKERS.some((marker) => html.includes(marker));
}

export function cifraClubUrls(artistSlug: string, slug: string) {
  return [
    `https://www.cifraclub.com.br/${artistSlug}/${slug}/imprimir.html`,
    `https://www.cifraclub.com.br/${artistSlug}/${slug}/`,
  ];
}

/** Latest Wayback Machine snapshot of the Cifra Club page (`id_` = original HTML, no toolbar). */
export function waybackUrls(artistSlug: string, slug: string, now = new Date()) {
  const timestamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  return cifraClubUrls(artistSlug, slug).map(
    (url) => `https://web.archive.org/web/${timestamp}id_/${url}`,
  );
}

async function firstUsable(urls: string[]): Promise<CifraSourceResult | null> {
  for (const url of urls) {
    const html = await fetchUpstreamHtml(url);
    if (html && isUsableCifraHtml(html)) return { html, url };
  }
  return null;
}

/**
 * Cifra Club's Akamai edge rejects most datacenter IPs (e.g. Vercel), so fall back to
 * its archived copy (same arrangement) and then to Ultimate Guitar (different arrangement).
 */
export async function fetchCifraFromSources(
  artistSlug: string,
  slug: string,
): Promise<CifraSourceResult | null> {
  const direct = await firstUsable(cifraClubUrls(artistSlug, slug));
  if (direct) return direct;

  console.warn(`[cifra-html] Cifra Club indisponível para ${artistSlug}/${slug}; usando fallback`);
  return (await firstUsable(waybackUrls(artistSlug, slug)))
    ?? (await fetchUltimateGuitarCifra(artistSlug, slug));
}
