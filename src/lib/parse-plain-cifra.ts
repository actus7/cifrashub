import { classifySection } from "@/lib/music";
import { parseChordLinePair } from "@/lib/parser";
import type { LyricLine, Section, SectionType } from "@/lib/types";

export function cleanSongSections(sections: Section[]): Section[] {
  return sections.map((s) => {
    const cleanedContent = s.content
      .map((line) => cleanLyricLine(line))
      .filter((line): line is LyricLine => line !== null);

    trimTrailingEmptyLines(cleanedContent);

    return {
      ...s,
      content: cleanedContent,
    };
  });
}

function cleanLyricLine(line: LyricLine): LyricLine | null {
  if (isSingleTabLine(line)) return cleanTabLine(line);
  if (isEmptyLyricLine(line)) return line;
  return cleanChordLyricLine(line);
}

function isSingleTabLine(line: LyricLine): boolean {
  return line.length === 1 && Boolean(line[0]?.isTab);
}

function cleanTabLine(line: LyricLine): LyricLine | null {
  const block = line[0];
  if (!block) return null;
  const text = block.text.replace(/\s+$/u, "");
  return text.trim() ? [{ ...block, text }] : null;
}

function cleanChordLyricLine(line: LyricLine): LyricLine | null {
  const filtered = line.filter(hasChordOrText) as LyricLine;
  return filtered.length > 0 ? filtered : null;
}

function hasChordOrText(block: LyricLine[number]): boolean {
  return Boolean(block.chord.trim() || block.text.trim());
}

function trimTrailingEmptyLines(lines: LyricLine[]) {
  while (lines.length > 0 && isEmptyLyricLine(lines[lines.length - 1])) {
    lines.pop();
  }
}

const CHORD_PATTERN =
  "([A-G][#b]?(?:maj|min|M)?(?:m(?!aj))?(?:\\d{1,2})?(?:sus[24]?|add\\d?|dim|aug)?(?:/[A-G][#b]?)?)\\b";

const SECTION_RE = /^\[(.+?)\]/;

function chordLineFromAngleMarkers(line: string): string {
  return line.replace(/‹CHORD:([^›]+)›\s*/g, "$1  ").trimEnd();
}

function lineHasAngleChordMarkers(line: string): boolean {
  return /‹CHORD:/.test(line);
}

function isChordOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const chordRe = new RegExp(CHORD_PATTERN);
  if (!chordRe.test(t)) return false;
  const remainder = t.replace(new RegExp(CHORD_PATTERN, "g"), "").trim();
  return remainder.length === 0;
}

function isTabLine(_line: string, stripped: string): boolean {
  return (
    /-{4,}/.test(stripped) ||
    /^[eBGDAE1-6]?\|.*-{2,}/i.test(stripped)
  );
}

function isEmptyLyricLine(line: LyricLine | undefined): boolean {
  const block = singleLineBlock(line);
  return Boolean(block && isEmptyBlock(block));
}

function singleLineBlock(line: LyricLine | undefined): LyricLine[number] | null {
  return line?.length === 1 ? (line[0] ?? null) : null;
}

function isEmptyBlock(block: LyricLine[number]): boolean {
  return !block.chord && !block.text && !block.isTab;
}

function lyricLineToPlainPair(line: LyricLine): string[] {
  if (line.length === 0) return [];
  return isSingleTabLine(line) ? tabLineText(line) : chordLyricPairLines(line);
}

function tabLineText(line: LyricLine) {
  return [line[0]?.text ?? ""];
}

function chordLyricPairLines(line: LyricLine) {
  const pair = line.reduce(appendPlainPairBlock, { chordLine: "", lyricLine: "" });
  return plainPairLines(finalChordLine(pair), pair.lyricLine.trimEnd());
}

function finalChordLine(pair: PlainPair) {
  return pair.chordLine.padEnd(pair.lyricLine.length, " ").trimEnd();
}

type PlainPair = { chordLine: string; lyricLine: string };

function appendPlainPairBlock(pair: PlainPair, block: LyricLine[number]): PlainPair {
  const chordLine = appendPlainChord(pair.chordLine, pair.lyricLine.length, block.chord);
  return {
    chordLine,
    lyricLine: pair.lyricLine + block.text + blockSpace(block),
  };
}

function appendPlainChord(chordLine: string, lyricStart: number, chord: string): string {
  const aligned = alignChordLine(chordLine, lyricStart, chord);
  return chord ? `${aligned}${chord}` : aligned;
}

function blockSpace(block: LyricLine[number]): string {
  return block.spaceAfter === false ? "" : " ";
}

function alignChordLine(chordLine: string, lyricStart: number, chord: string): string {
  const padded = chordLine.padEnd(lyricStart, " ");
  if (!chord || chordLine.length < lyricStart) return padded;
  return needsChordLinePadding(chordLine, lyricStart) ? `${chordLine}  ` : chordLine;
}

function needsChordLinePadding(chordLine: string, lyricStart: number) {
  return chordLine.length > lyricStart || shouldSeparateChord(chordLine, lyricStart);
}

function shouldSeparateChord(chordLine: string, lyricStart: number): boolean {
  return canCheckChordSeparation(chordLine, lyricStart) && isChordTail(chordLine.at(-1));
}

function canCheckChordSeparation(chordLine: string, lyricStart: number) {
  return lyricStart > 0 && chordLine.length === lyricStart && chordLine.length > 0;
}

function isChordTail(value: string | undefined) {
  return Boolean(value && value !== " " && /[A-G#b0-9/]/.test(value));
}

function plainPairLines(chordLine: string, lyricLine: string): string[] {
  return [chordLine, lyricLine].filter(Boolean);
}

export function sectionToPlainText(section: Section): string {
  const parts: string[] = [section.label];
  for (const row of section.content) {
    parts.push(...lyricLineToPlainPair(row));
  }
  return parts.join("\n");
}

export function sectionsToPlainText(sections: Section[]): string {
  const parts: string[] = [];
  for (const sec of sections) {
    parts.push(sec.label);
    for (const row of sec.content) {
      parts.push(...lyricLineToPlainPair(row));
    }
    parts.push("");
  }
  return parts.join("\n").replace(/\n+$/u, "");
}

export function joinSectionPlainTexts(blocks: string[]): string {
  if (blocks.length === 0) return "";
  return blocks.join("\n\n").replace(/\n+$/u, "");
}

type ParsePlainCifraResult =
  | { ok: true; data: Section[] }
  | { ok: false; error: string };

type ParseState = {
  sections: Section[];
  currentLabel: string;
  currentType: SectionType;
  currentLines: LyricLine[];
  isImplicitEmptyDefaultSection: boolean;
};

function createParseState(): ParseState {
  return {
    sections: [],
    currentLabel: "[Verso]",
    currentType: "verse",
    currentLines: [],
    isImplicitEmptyDefaultSection: true,
  };
}

function flushSection(state: ParseState) {
  if (state.currentLines.length > 0) {
    state.sections.push({
      type: state.currentType,
      label: state.currentLabel,
      content: [...state.currentLines],
    });
    state.isImplicitEmptyDefaultSection = false;
    return;
  }

  if (!state.isImplicitEmptyDefaultSection) {
    state.sections.push({
      type: state.currentType,
      label: state.currentLabel,
      content: [],
    });
  }
}

function startSection(state: ParseState, label: string, typeText: string) {
  flushSection(state);
  state.currentLines = [];
  state.currentLabel = label;
  state.currentType = classifySection(typeText);
  state.isImplicitEmptyDefaultSection = false;
}

function addParsedLine(state: ParseState, line: LyricLine) {
  state.currentLines.push(line);
  state.isImplicitEmptyDefaultSection = false;
}

function isSectionHeaderLine(line: string, stripped: string): RegExpMatchArray | null {
  const match = stripped.match(SECTION_RE);
  if (!match || isChordOnlyLine(line) || isTabLine(line, stripped)) return null;
  return match;
}

function isMarkerChordLine(line: string, stripped: string): boolean {
  return (
    lineHasAngleChordMarkers(line) &&
    !isTabLine(line, stripped) &&
    !SECTION_RE.test(stripped)
  );
}

function canConsumeNextLyricLine(lines: string[], index: number): boolean {
  const nextLine = lines[index + 1];
  return nextLine !== undefined && isPlainLyricCandidate(nextLine);
}

function isPlainLyricCandidate(line: string) {
  const stripped = line.trim();
  return !isChordOnlyLine(line)
    && !lineHasAngleChordMarkers(line)
    && !SECTION_RE.test(stripped)
    && !isTabLine(line, stripped);
}

function parseChordBlocks(lines: string[], index: number, markerLine: boolean) {
  const lyricLine = nextLyricLine(lines, index);
  return {
    blocks: parseChordLinePair(cleanChordLine(lines[index] ?? "", markerLine), lyricLine),
    consumedNextLine: lyricLine !== "",
  };
}

function cleanChordLine(line: string, markerLine: boolean) {
  return markerLine ? chordLineFromAngleMarkers(line) : line;
}

function nextLyricLine(lines: string[], index: number) {
  return canConsumeNextLyricLine(lines, index) ? (lines[index + 1] ?? "") : "";
}

function addBlankLine(state: ParseState) {
  if (state.currentLines.length === 0) return;
  if (isEmptyLyricLine(state.currentLines[state.currentLines.length - 1])) return;
  state.currentLines.push([{ chord: "", text: "", spaceAfter: true }]);
}

function handlePlainLine(state: ParseState, stripped: string) {
  if (stripped) {
    addParsedLine(state, [{ chord: "", text: stripped, spaceAfter: true }]);
    return;
  }
  addBlankLine(state);
}

export function parsePlainTextCifra(raw: string): ParsePlainCifraResult {
  const normalized = normalizePlainCifra(raw);
  if (!normalized.trim()) return plainParseError("Digite o conteúdo da cifra.");

  const state = parsePlainLines(normalized.split("\n"));
  flushSection(state);

  if (state.sections.length === 0) {
    return plainParseError("Não foi possível montar seções a partir do texto.");
  }

  return { ok: true, data: state.sections };
}

function normalizePlainCifra(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/<CHORD:([^>]+)>/gi, "‹CHORD:$1›");
}

function plainParseError(error: string): ParsePlainCifraResult {
  return { ok: false, error };
}

function parsePlainLines(lines: string[]): ParseState {
  const state = createParseState();
  for (let i = 0; i < lines.length; i++) {
    i += parsePlainLine(state, lines, i);
  }
  return state;
}

type PlainLineContext = {
  line: string;
  stripped: string;
};

function plainLineContext(lines: string[], index: number): PlainLineContext {
  const line = lines[index] ?? "";
  return { line, stripped: line.trim() };
}

function parsePlainLine(state: ParseState, lines: string[], index: number): number {
  const context = plainLineContext(lines, index);
  return parseStructuredPlainLine(state, lines, index, context)
    ?? parsePlainTextLine(state, context.stripped);
}

function parseStructuredPlainLine(
  state: ParseState,
  lines: string[],
  index: number,
  context: PlainLineContext,
): number | null {
  return parsePlainSection(state, context)
    ?? parsePlainTab(state, context)
    ?? parsePlainChordOrMarker(state, lines, index, context);
}

function parsePlainSection(state: ParseState, context: PlainLineContext): number | null {
  const sectionMatch = isSectionHeaderLine(context.line, context.stripped);
  return sectionMatch ? parseSectionLine(state, context.stripped, sectionMatch[1] ?? "") : null;
}

function parsePlainTab(state: ParseState, context: PlainLineContext): number | null {
  return isTabLine(context.line, context.stripped) ? parseTabLine(state, context.line) : null;
}

function parsePlainChordOrMarker(
  state: ParseState,
  lines: string[],
  index: number,
  context: PlainLineContext,
): number | null {
  return isChordOrMarkerLine(context.line, context.stripped)
    ? parseChordOrMarkerLine(state, lines, index, context.line, context.stripped)
    : null;
}

function parsePlainTextLine(state: ParseState, stripped: string): number {
  handlePlainLine(state, stripped);
  return 0;
}

function parseSectionLine(state: ParseState, stripped: string, typeText: string): number {
  startSection(state, stripped, typeText);
  return 0;
}

function parseTabLine(state: ParseState, line: string): number {
  addParsedLine(state, [
    { chord: "", text: line.replace(/\s+$/, ""), isTab: true, spaceAfter: true },
  ]);
  return 0;
}

function isChordOrMarkerLine(line: string, stripped: string): boolean {
  return isChordOnlyLine(line) || isMarkerChordLine(line, stripped);
}

function parseChordOrMarkerLine(
  state: ParseState,
  lines: string[],
  index: number,
  line: string,
  stripped: string,
): number {
  const markerLine = isMarkerChordLine(line, stripped);
  const { blocks, consumedNextLine } = parseChordBlocks(lines, index, markerLine);
  if (blocks.length > 0) addParsedLine(state, blocks);
  return consumedNextLine ? 1 : 0;
}
