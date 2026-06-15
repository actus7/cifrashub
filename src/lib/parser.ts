import { classifySection, transposeRootNote } from "./music";
import { isValidYoutubeId } from "./youtube";
import type { LyricBlock, LyricLine, Section, SectionType, StoredSong } from "./types";

function randomUuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0;
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const CHORD_PATTERN =
  "([A-G][#b]?(?:maj|min|M)?(?:m(?!aj))?(?:\\d{1,2})?(?:sus[24]?|add\\d?|dim|aug)?(?:/[A-G][#b]?)?)\\b";

export function parseChordLinePair(chordLine: string, lyricLine: string): LyricBlock[] {
  const matches = [...chordLine.matchAll(new RegExp(CHORD_PATTERN, "g"))];
  if (matches.length === 0) return plainLyricBlocks(lyricLine);

  const blocks = leadingLyricBlocks(matches, lyricLine);
  for (let i = 0; i < matches.length; i++) {
    const block = chordMatchToBlock(matches, i, lyricLine);
    if (block) blocks.push(block);
  }
  return blocks;
}

function plainLyricBlocks(lyricLine: string): LyricBlock[] {
  const text = lyricLine.replace(/\r?\n$/, "");
  return text.trim() || lyricLine === ""
    ? [{ chord: "", text, spaceAfter: true }]
    : [];
}

function leadingLyricBlocks(matches: RegExpMatchArray[], lyricLine: string): LyricBlock[] {
  const firstIndex = matches[0]?.index ?? 0;
  const prefix = lyricLine.slice(0, firstIndex);
  if (firstIndex <= 0 || !prefix.trim()) return [];
  return [{ chord: "", text: prefix.trimEnd(), spaceAfter: /\s+$/.test(prefix) || prefix.length < firstIndex }];
}

function chordMatchToBlock(
  matches: RegExpMatchArray[],
  index: number,
  lyricLine: string,
): LyricBlock | null {
  const match = matches[index];
  if (!match || match.index === undefined) return null;

  const chord = match[1] as string;
  const start = match.index;
  const end = matchEnd(matches[index + 1], lyricLine, start, chord.length);
  const textSegment = start < lyricLine.length ? lyricLine.slice(start, end) : "";
  const text = textSegment.trimEnd();

  return {
    chord,
    text,
    spaceAfter: /\s+$/.test(textSegment) || (text === "" && index < matches.length - 1),
  };
}

function matchEnd(
  next: RegExpMatchArray | undefined,
  lyricLine: string,
  start: number,
  chordLength: number,
): number {
  return next?.index !== undefined
    ? next.index
    : Math.max(lyricLine.length, start + chordLength);
}

const CHORD_MARKER_RE = /‹CHORD:([^›]+)›/;
const SECTION_RE = /^\[(.+?)\]/;
const KEY_ROOT_RE = /key:\s*["']([A-G][#b]?)["']/;

function extractCifraClubKeyCapo(htmlContent: string): {
  writtenKey?: string;
  capo?: number;
} {
  const block = keyCapoScriptBlock(htmlContent);
  const visible = visibleKeyCapo(htmlContent);
  const writtenKey = keyFromScript(block, htmlContent) ?? visible.writtenKey;
  const capoRaw = capoFromScript(block) ?? visible.capoRaw;
  const capo = capoRaw !== undefined
    ? Math.min(24, Math.max(0, parseInt(capoRaw, 10)))
    : undefined;

  return {
    ...(writtenKey ? { writtenKey } : {}),
    ...(capo !== undefined ? { capo } : {}),
  };
}

function keyCapoScriptBlock(htmlContent: string): string {
  return htmlContent.match(/urlAPI3:\s*["'][^"']+["']([\s\S]{0,3500}?)chords:\s*\[/)?.[1] ?? htmlContent;
}

function keyFromScript(block: string, htmlContent: string): string | undefined {
  return (block.match(KEY_ROOT_RE) ?? htmlContent.match(KEY_ROOT_RE))?.[1]?.trim();
}

function capoFromScript(block: string): string | undefined {
  return block.match(/capo:\s*(\d+)/)?.[1];
}

function normalizeNoteText(value: string): string {
  return value.replace("♯", "#").replace("♭", "b").trim();
}

function visibleKeyCapo(htmlContent: string): { writtenKey?: string; capoRaw?: string } {
  const tomHtml = htmlContent.match(/id=["']cifra_tom["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (!tomHtml) return {};
  return {
    writtenKey: visibleWrittenKey(tomHtml),
    capoRaw: tomHtml.match(/[Cc]apotraste\s+na\s+(\d+)/)?.[1],
  };
}

function visibleWrittenKey(tomHtml: string): string | undefined {
  const formKey = tomHtml.match(/forma\s+dos\s+acordes\s+no\s+tom\s+de\s+([A-G][#b♯♭]?m?)/i)?.[1];
  if (formKey) return normalizeNoteText(formKey);
  const linkKey = tomHtml.match(/<a[^>]*>\s*([A-G][#b♯♭]?m?)\s*<\/a>/i)?.[1];
  return linkKey ? normalizeNoteText(linkKey) : undefined;
}

export function extractYoutubeIdFromHtml(htmlContent: string): string | undefined {
  return (
    firstValidYoutubeId(htmlContent, curatedYoutubePatterns()) ??
    firstValidYoutubeId(htmlContent, urlYoutubePatterns()) ??
    youtubeIdFromDom(htmlContent) ??
    firstValidYoutubeId(htmlContent, fallbackVideoIdPatterns())
  );
}

function firstValidYoutubeId(htmlContent: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const id = htmlContent.match(pattern)?.[1]?.trim();
    if (isValidYoutubeId(id)) return id;
  }
  return undefined;
}

function curatedYoutubePatterns(): RegExp[] {
  return [
    /["']youtubeId["']\s*:\s*["']([a-zA-Z0-9_-]{11})["']/,
    /youtubeId\s*:\s*["']([a-zA-Z0-9_-]{11})["']/,
  ];
}

function urlYoutubePatterns(): RegExp[] {
  return [
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /data-video(?:id)?=["']([a-zA-Z0-9_-]{11})["']/i,
    /aria-label=["']https?:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];
}

function fallbackVideoIdPatterns(): RegExp[] {
  return [
    /["']videoId["']\s*:\s*["']([a-zA-Z0-9_-]{11})["']/,
    /videoId\s*:\s*["']([a-zA-Z0-9_-]{11})["']/,
  ];
}

function youtubeIdFromDom(htmlContent: string): string | undefined {
  if (typeof DOMParser === "undefined") return undefined;

  const doc = new DOMParser().parseFromString(htmlContent, "text/html");
  return youtubeIdFromIframe(doc) ?? youtubeIdFromWatchLink(doc);
}

function youtubeIdFromIframe(doc: Document): string | undefined {
  const src = doc.querySelector("iframe[src*='youtube']")?.getAttribute("src") ?? "";
  return validMatchedId(src.match(/embed\/([a-zA-Z0-9_-]{11})/)?.[1])
    ?? validMatchedId(src.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1]);
}

function youtubeIdFromWatchLink(doc: Document): string | undefined {
  const selector = "a[href*='youtube.com/watch?v='], a[aria-label*='youtube.com/watch?v=']";
  const el = doc.querySelector(selector);
  const value = el?.getAttribute("href") ?? el?.getAttribute("aria-label") ?? "";
  return validMatchedId(value.match(/v=([a-zA-Z0-9_-]{11})/)?.[1]);
}

function validMatchedId(id: string | undefined): string | undefined {
  return isValidYoutubeId(id) ? id : undefined;
}

type HtmlParseState = {
  sections: Section[];
  currentLabel: string;
  currentType: SectionType;
  currentLines: LyricLine[];
};

function parseHtmlCifra(htmlContent: string): Section[] {
  const doc = htmlToCifraDocument(htmlContent);
  const lines = (doc.body.textContent ?? "").split("\n");
  const state = createHtmlParseState();

  for (let i = 0; i < lines.length; i++) {
    const result = parseHtmlLine(state, lines, i);
    if (result.consumedNextLine) i++;
  }

  flushHtmlSection(state);
  return state.sections;
}

function htmlToCifraDocument(htmlContent: string): Document {
  const doc = new DOMParser().parseFromString(htmlContent, "text/html");
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("b").forEach((el) => el.replaceWith(`‹CHORD:${el.textContent ?? ""}›`));
  doc.querySelectorAll("span.cnt, span.tablatura").forEach((el) => {
    el.replaceWith((el.textContent ?? "").split("\n").map((l) => "‹TAB_LINE›" + l).join("\n"));
  });
  return doc;
}

function createHtmlParseState(): HtmlParseState {
  return {
    sections: [],
    currentLabel: "[Verso]",
    currentType: "verse",
    currentLines: [],
  };
}

function flushHtmlSection(state: HtmlParseState) {
  if (state.currentLines.length === 0) return;
  state.sections.push({
    type: state.currentType,
    label: state.currentLabel,
    content: [...state.currentLines],
  });
}

function parseHtmlLine(state: HtmlParseState, lines: string[], index: number) {
  const line = lines[index] ?? "";
  const stripped = line.trim();
  const section = htmlSectionMatch(line, stripped);
  if (section) {
    startHtmlSection(state, stripped, section[1] ?? "");
    return { consumedNextLine: false };
  }

  if (isHtmlTabLine(line, stripped)) {
    state.currentLines.push([{ chord: "", text: htmlTabText(line), isTab: true, spaceAfter: true }]);
    return { consumedNextLine: false };
  }

  if (CHORD_MARKER_RE.test(line)) {
    return parseHtmlChordLine(state, lines, index, line);
  }

  if (stripped) state.currentLines.push([{ chord: "", text: stripped, spaceAfter: true }]);
  return { consumedNextLine: false };
}

function htmlSectionMatch(line: string, stripped: string): RegExpMatchArray | null {
  const match = stripped.match(SECTION_RE);
  if (!match || CHORD_MARKER_RE.test(line) || line.includes("‹TAB_LINE›")) return null;
  return match;
}

function startHtmlSection(state: HtmlParseState, label: string, typeText: string) {
  flushHtmlSection(state);
  state.currentLines = [];
  state.currentLabel = label;
  state.currentType = classifySection(typeText);
}

function isHtmlTabLine(line: string, stripped: string): boolean {
  return line.includes("‹TAB_LINE›") || /-{4,}/.test(stripped) || /^[eBGDAE1-6]?\|.*-{2,}/i.test(stripped);
}

function htmlTabText(line: string): string {
  return line.replace(/‹TAB_LINE›/g, "").replace(/\s+$/, "");
}

function parseHtmlChordLine(
  state: HtmlParseState,
  lines: string[],
  index: number,
  line: string,
) {
  const lyricLine = htmlNextLyricLine(lines, index);
  const blocks = parseChordLinePair(line.replace(/‹CHORD:([^›]+)›/g, "$1"), lyricLine);
  if (blocks.length > 0) state.currentLines.push(blocks);
  return { consumedNextLine: lyricLine !== "" };
}

function htmlNextLyricLine(lines: string[], index: number): string {
  const nextLine = lines[index + 1];
  if (nextLine === undefined) return "";
  if (CHORD_MARKER_RE.test(nextLine)) return "";
  if (SECTION_RE.test(nextLine.trim())) return "";
  if (nextLine.includes("‹TAB_LINE›")) return "";
  return nextLine;
}

function extractDisplayTitle(doc: Document, fallbackTitle: string, slug: string): string {
  return doc.querySelector("h1")?.textContent?.trim()
    ?? titleTagPart(doc, 0)
    ?? fallbackTitle
    ?? titleFromSlug(slug);
}

function extractDisplayArtist(doc: Document, fallbackArtist: string, artistSlug: string): string {
  return doc.querySelector("h2")?.textContent?.trim()
    ?? titleTagPart(doc, 1)
    ?? fallbackArtist
    ?? titleFromSlug(artistSlug);
}

function titleTagPart(doc: Document, index: number): string | undefined {
  const titleTag = doc.querySelector("title")?.textContent;
  if (!titleTag?.includes(" - ")) return undefined;
  return titleTag.split(" - ")[index]?.trim();
}

function titleFromSlug(slug: string): string {
  return slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function contentNodeFromDocument(doc: Document): Element | null {
  const selected = doc.querySelector("#cifra_conteudo")
    ?? doc.querySelector(".g-fix pre")
    ?? doc.querySelector(".cifra_cnt pre")
    ?? doc.querySelector(".cifra_cnt");
  if (selected) return selected;

  return Array.from(doc.querySelectorAll("pre"))
    .sort((a, b) => (b.textContent ?? "").length - (a.textContent ?? "").length)[0]
    ?? null;
}

function keyMetadata(htmlContent: string) {
  const { writtenKey, capo } = extractCifraClubKeyCapo(htmlContent);
  const soundingKey = writtenKey ? transposeRootNote(writtenKey, capo ?? 0) : undefined;
  return {
    cifraWrittenKey: writtenKey,
    cifraCapo: capo,
    cifraSoundingKey: soundingKey,
  };
}

export function processHtmlAndExtract(
  htmlContent: string,
  songId: string,
  title: string,
  artistName: string,
  artistSlug: string,
  slug: string,
): StoredSong {
  const doc = new DOMParser().parseFromString(htmlContent, "text/html");
  const contentNode = contentNodeFromDocument(doc);
  if (!contentNode || (contentNode.textContent ?? "").trim().length < 20) {
    throw new Error("Cifra indisponível neste formato.");
  }

  const parsedSections = parseHtmlCifra(contentNode.outerHTML);
  if (parsedSections.length === 0) throw new Error("Erro ao processar cifra.");

  return {
    id: songId,
    arrangementId: randomUuid(),
    title: extractDisplayTitle(doc, title, slug),
    artist: extractDisplayArtist(doc, artistName, artistSlug),
    artistSlug,
    slug,
    sourceArtistSlug: artistSlug,
    sourceSlug: slug,
    youtubeId: extractYoutubeIdFromHtml(htmlContent),
    songData: parsedSections,
    ...keyMetadata(htmlContent),
  };
}
