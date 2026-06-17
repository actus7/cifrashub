import { classifySection, transposeRootNote } from "./music";
import { parseChordLinePair } from "./parse-chord-line-pair";
import { extractYoutubeIdFromHtml } from "./extract-youtube-id-from-html";
import type { LyricLine, Section, SectionType, StoredSong } from "./types";

function randomUuid(): string {
  const nativeUuid = cryptoRandomUuid();
  if (nativeUuid) return nativeUuid;
  const bytes = randomUuidBytes();
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return formatUuidBytes(bytes);
}

function cryptoRandomUuid() {
  const c = globalThis.crypto;
  return typeof c?.randomUUID === "function" ? c.randomUUID() : null;
}

function randomUuidBytes() {
  const bytes = new Uint8Array(16);
  const c = globalThis.crypto;
  if (typeof c?.getRandomValues === "function") {
    c.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0;
  return bytes;
}

function formatUuidBytes(bytes: Uint8Array) {
  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}


const CHORD_MARKER_RE = /‹CHORD:([^›]+)›/;
const SECTION_RE = /^\[(.+?)\]/;
const KEY_ROOT_RE = /key:\s*["']([A-G][#b]?)["']/;

function extractCifraClubKeyCapo(htmlContent: string): {
  writtenKey?: string;
  capo?: number;
} {
  const metadata = keyCapoMetadata(htmlContent);
  return keyCapoResult(metadata.writtenKey, metadata.capoRaw);
}

function keyCapoMetadata(htmlContent: string) {
  const block = keyCapoScriptBlock(htmlContent);
  const visible = visibleKeyCapo(htmlContent);
  return {
    writtenKey: keyFromScript(block, htmlContent) ?? visible.writtenKey,
    capoRaw: capoFromScript(block) ?? visible.capoRaw,
  };
}

function keyCapoResult(writtenKey: string | undefined, capoRaw: string | undefined) {
  const capo = parseCapoValue(capoRaw);
  return {
    ...(writtenKey ? { writtenKey } : {}),
    ...(capo !== undefined ? { capo } : {}),
  };
}

function parseCapoValue(capoRaw: string | undefined) {
  return capoRaw !== undefined
    ? Math.min(24, Math.max(0, parseInt(capoRaw, 10)))
    : undefined;
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
  return normalizeOptionalNote(visibleFormKey(tomHtml) ?? visibleLinkKey(tomHtml));
}

function visibleFormKey(tomHtml: string): string | undefined {
  return tomHtml.match(/forma\s+dos\s+acordes\s+no\s+tom\s+de\s+([A-G][#b♯♭]?m?)/i)?.[1];
}

function visibleLinkKey(tomHtml: string): string | undefined {
  return tomHtml.match(/<a[^>]*>\s*([A-G][#b♯♭]?m?)\s*<\/a>/i)?.[1];
}

function normalizeOptionalNote(note: string | undefined): string | undefined {
  return note ? normalizeNoteText(note) : undefined;
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

  return parseHtmlSectionMatch(state, line, stripped)
    ?? parseHtmlSpecialLine(state, lines, index, line, stripped)
    ?? parseHtmlPlainLine(state, stripped);
}

function parseHtmlSectionMatch(state: HtmlParseState, line: string, stripped: string) {
  const section = htmlSectionMatch(line, stripped);
  return section ? parseHtmlSectionLine(state, stripped, section[1] ?? "") : null;
}

function parseHtmlSpecialLine(
  state: HtmlParseState,
  lines: string[],
  index: number,
  line: string,
  stripped: string,
) {
  if (isHtmlTabLine(line, stripped)) return parseHtmlTabLine(state, line);
  return CHORD_MARKER_RE.test(line) ? parseHtmlChordLine(state, lines, index, line) : null;
}

function parseHtmlPlainLine(state: HtmlParseState, stripped: string) {
  addHtmlPlainLine(state, stripped);
  return htmlLineResult(false);
}

function htmlLineResult(consumedNextLine: boolean) {
  return { consumedNextLine };
}

function parseHtmlSectionLine(state: HtmlParseState, stripped: string, typeText: string) {
  startHtmlSection(state, stripped, typeText);
  return htmlLineResult(false);
}

function parseHtmlTabLine(state: HtmlParseState, line: string) {
  state.currentLines.push([{ chord: "", text: htmlTabText(line), isTab: true, spaceAfter: true }]);
  return htmlLineResult(false);
}

function addHtmlPlainLine(state: HtmlParseState, stripped: string) {
  if (stripped) state.currentLines.push([{ chord: "", text: stripped, spaceAfter: true }]);
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
  return htmlLineResult(lyricLine !== "");
}

function htmlNextLyricLine(lines: string[], index: number): string {
  const nextLine = lines[index + 1];
  return nextLine && isHtmlLyricCandidate(nextLine) ? nextLine : "";
}

function isHtmlLyricCandidate(line: string) {
  return !CHORD_MARKER_RE.test(line)
    && !SECTION_RE.test(line.trim())
    && !line.includes("‹TAB_LINE›");
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

const CONTENT_SELECTORS = [
  "#cifra_conteudo",
  ".g-fix pre",
  ".cifra_cnt pre",
  ".cifra_cnt",
] as const;

function contentNodeFromDocument(doc: Document): Element | null {
  return selectedContentNode(doc) ?? longestPreNode(doc);
}

function selectedContentNode(doc: Document): Element | null {
  for (const selector of CONTENT_SELECTORS) {
    const node = doc.querySelector(selector);
    if (node) return node;
  }
  return null;
}

function longestPreNode(doc: Document): Element | null {
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
  const contentNode = requireCifraContentNode(doc);
  const parsedSections = requireParsedSections(contentNode);

  return storedSongFromHtml({
    artistName,
    artistSlug,
    doc,
    htmlContent,
    parsedSections,
    slug,
    songId,
    title,
  });
}

type HtmlSongArgs = {
  artistName: string;
  artistSlug: string;
  doc: Document;
  htmlContent: string;
  parsedSections: Section[];
  slug: string;
  songId: string;
  title: string;
};

function requireCifraContentNode(doc: Document) {
  const contentNode = contentNodeFromDocument(doc);
  if (!contentNode || (contentNode.textContent ?? "").trim().length < 20) {
    throw new Error("Cifra indisponível neste formato.");
  }
  return contentNode;
}

function requireParsedSections(contentNode: Element) {
  const parsedSections = parseHtmlCifra(contentNode.outerHTML);
  if (parsedSections.length === 0) throw new Error("Erro ao processar cifra.");
  return parsedSections;
}

function storedSongFromHtml({
  artistName,
  artistSlug,
  doc,
  htmlContent,
  parsedSections,
  slug,
  songId,
  title,
}: HtmlSongArgs): StoredSong {
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
