import { fetchUpstreamHtml } from "./cifra-route";

const UG_SEARCH_URL = "https://www.ultimate-guitar.com/search.php";
const UG_HOST_SUFFIX = ".ultimate-guitar.com";
const STORE_RE = /class="js-store" data-content="([^"]*)"/;
const KEY_RE = /^[A-G][#b]?m?$/;

export type UgSearchResult = {
  type?: string;
  artist_name?: string;
  song_name?: string;
  rating?: number;
  votes?: number;
  tab_url?: string;
};

export type UgTab = {
  tab?: { song_name?: string; artist_name?: string; tonality_name?: string };
  tab_view?: { wiki_tab?: { content?: string }; meta?: { capo?: number } };
};

const ATTR_ENTITIES: Record<string, string> = {
  quot: '"',
  "#039": "'",
  lt: "<",
  gt: ">",
  amp: "&",
};

/** Ultimate Guitar ships page data as HTML-escaped JSON in `.js-store[data-content]`. */
export function readUgStore(html: string): Record<string, unknown> | null {
  const raw = html.match(STORE_RE)?.[1];
  if (!raw) return null;
  try {
    const json = raw.replace(/&(quot|#039|lt|gt|amp);/g, (_, e: string) => ATTR_ENTITIES[e]!);
    const store = JSON.parse(json) as { store?: { page?: { data?: Record<string, unknown> } } };
    return store.store?.page?.data ?? null;
  } catch {
    return null;
  }
}

/** UG names keep accents as HTML entities ("Legi&atilde;o"); reduce to a Cifra Club-style slug. */
export function ugSlug(name: string): string {
  return name
    .replace(/&([a-z])(acute|grave|tilde|circ|uml|cedil|ring);/gi, "$1")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function songSlugMatches(songName: string, slug: string) {
  const candidate = ugSlug(songName);
  return candidate === slug || candidate.startsWith(`${slug}-`) || slug.startsWith(`${candidate}-`);
}

function isUgTabUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname.endsWith(UG_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** Best-voted "Chords" result whose artist and song match the Cifra Club slugs; null if none do. */
export function pickUgTab(results: UgSearchResult[], artistSlug: string, slug: string): string | null {
  const matches = results.filter(
    (r) =>
      r.type === "Chords"
      && isUgTabUrl(r.tab_url)
      && ugSlug(r.artist_name ?? "") === artistSlug
      && songSlugMatches(r.song_name ?? "", slug),
  );
  matches.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0) || (b.rating ?? 0) - (a.rating ?? 0));
  return matches[0]?.tab_url ?? null;
}

function escapeTags(text: string) {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function keyBlock(tonality: string | undefined, capo: number | undefined) {
  if (!tonality || !KEY_RE.test(tonality)) return "";
  const capoText = capo && capo > 0 ? ` (Capotraste na ${capo}ª casa)` : "";
  return `<div id="cifra_tom">Tom: <a>${tonality}</a>${capoText}</div>`;
}

/**
 * Converts UG `[ch]C[/ch]` / `[tab]…[/tab]` markup into the `<pre>` + `<b>` shape
 * that `processHtmlAndExtract` already parses. Text is already entity-encoded by UG.
 */
export function ugTabToCifraHtml(data: UgTab): string | null {
  const content = data.tab_view?.wiki_tab?.content;
  if (!content?.trim()) return null;

  const body = escapeTags(content.replace(/\r/g, ""))
    .replace(/\[ch\]([\s\S]*?)\[\/ch\]/g, "<b>$1</b>")
    .replace(/\[\/?tab\]/g, "");
  const title = escapeTags(data.tab?.song_name ?? "");
  const artist = escapeTags(data.tab?.artist_name ?? "");

  return [
    `<html><head><title>${title} - ${artist}</title></head><body>`,
    `<h1>${title}</h1><h2>${artist}</h2>`,
    keyBlock(data.tab?.tonality_name, data.tab_view?.meta?.capo),
    `<pre>${body}</pre>`,
    "</body></html>",
  ].join("");
}

async function searchUgTabUrl(artistSlug: string, slug: string) {
  const query = `${artistSlug} ${slug}`.replace(/-/g, " ");
  const params = new URLSearchParams({ search_type: "title", value: query });
  const html = await fetchUpstreamHtml(`${UG_SEARCH_URL}?${params}`);
  const results = html ? readUgStore(html)?.results : null;
  return Array.isArray(results) ? pickUgTab(results as UgSearchResult[], artistSlug, slug) : null;
}

export async function fetchUltimateGuitarCifra(artistSlug: string, slug: string) {
  const url = await searchUgTabUrl(artistSlug, slug);
  if (!url) return null;

  const page = await fetchUpstreamHtml(url);
  const data = page ? readUgStore(page) : null;
  const html = data ? ugTabToCifraHtml(data as UgTab) : null;
  return html ? { html, url } : null;
}
