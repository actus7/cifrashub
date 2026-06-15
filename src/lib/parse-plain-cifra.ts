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
  if (line.length === 1 && line[0]?.isTab) {
    const text = line[0].text.replace(/\s+$/u, "");
    return text.trim() ? [{ ...line[0], text }] : null;
  }

  if (isEmptyLyricLine(line)) return line;

  const filtered = line.filter(
    (b) => b.chord.trim() || b.text.trim(),
  ) as LyricLine;
  return filtered.length > 0 ? filtered : null;
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
  return Boolean(
    line &&
    line.length === 1 &&
    !line[0]?.chord &&
    !line[0]?.text &&
    !line[0]?.isTab,
  );
}

function lyricLineToPlainPair(line: LyricLine): string[] {
  if (line.length === 1 && line[0]?.isTab) return [line[0].text];
  if (line.length === 0) return [];

  let chordLine = "";
  let lyricLine = "";
  for (const block of line) {
    const lyricStart = lyricLine.length;
    chordLine = alignChordLine(chordLine, lyricStart, block.chord);
    if (block.chord) chordLine += block.chord;
    lyricLine += block.text + (block.spaceAfter === false ? "" : " ");
  }

  chordLine = chordLine.padEnd(lyricLine.length, " ");
  return plainPairLines(chordLine.trimEnd(), lyricLine.trimEnd());
}

function alignChordLine(chordLine: string, lyricStart: number, chord: string): string {
  if (!chord) return chordLine.padEnd(lyricStart, " ");
  if (chordLine.length < lyricStart) return chordLine.padEnd(lyricStart, " ");
  if (chordLine.length > lyricStart) return `${chordLine}  `;
  if (!shouldSeparateChord(chordLine, lyricStart)) return chordLine;
  return `${chordLine}  `;
}

function shouldSeparateChord(chordLine: string, lyricStart: number): boolean {
  if (lyricStart === 0 || chordLine.length !== lyricStart || chordLine.length === 0) {
    return false;
  }
  const lastCh = chordLine[chordLine.length - 1];
  return Boolean(lastCh && lastCh !== " " && /[A-G#b0-9/]/.test(lastCh));
}

function plainPairLines(chordLine: string, lyricLine: string): string[] {
  if (chordLine && lyricLine) return [chordLine, lyricLine];
  if (chordLine) return [chordLine];
  if (lyricLine) return [lyricLine];
  return [];
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
  if (nextLine === undefined) return false;
  const stripped = nextLine.trim();
  return (
    index + 1 < lines.length &&
    !isChordOnlyLine(nextLine) &&
    !lineHasAngleChordMarkers(nextLine) &&
    !SECTION_RE.test(stripped) &&
    !isTabLine(nextLine, stripped)
  );
}

function parseChordBlocks(lines: string[], index: number, markerLine: boolean) {
  const line = lines[index] ?? "";
  const chordLineClean = markerLine ? chordLineFromAngleMarkers(line) : line;
  const lyricLine = canConsumeNextLyricLine(lines, index) ? (lines[index + 1] ?? "") : "";
  return {
    blocks: parseChordLinePair(chordLineClean, lyricLine),
    consumedNextLine: lyricLine !== "",
  };
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
  const normalized = raw
    .replace(/\r\n/g, "\n")
    .replace(/<CHORD:([^>]+)>/gi, "‹CHORD:$1›");
  if (!normalized.trim()) {
    return { ok: false, error: "Digite o conteúdo da cifra." };
  }

  const lines = normalized.split("\n");
  const state = createParseState();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const stripped = line.trim();
    const sectionMatch = isSectionHeaderLine(line, stripped);

    if (sectionMatch) {
      startSection(state, stripped, sectionMatch[1] ?? "");
      continue;
    }

    if (isTabLine(line, stripped)) {
      addParsedLine(state, [
        { chord: "", text: line.replace(/\s+$/, ""), isTab: true, spaceAfter: true },
      ]);
      continue;
    }

    const markerLine = isMarkerChordLine(line, stripped);
    if (isChordOnlyLine(line) || markerLine) {
      const { blocks, consumedNextLine } = parseChordBlocks(lines, i, markerLine);
      if (blocks.length > 0) addParsedLine(state, blocks);
      if (consumedNextLine) i++;
      continue;
    }

    handlePlainLine(state, stripped);
  }

  flushSection(state);

  if (state.sections.length === 0) {
    return {
      ok: false,
      error: "Não foi possível montar seções a partir do texto.",
    };
  }

  return { ok: true, data: state.sections };
}
