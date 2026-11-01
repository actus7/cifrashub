import { findChordTokens, type ChordToken } from "./chord-grammar";
import type { LyricBlock } from "./types";

export function parseChordLinePair(chordLine: string, lyricLine: string): LyricBlock[] {
  const matches = findChordTokens(chordLine);
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

function leadingLyricBlocks(matches: ChordToken[], lyricLine: string): LyricBlock[] {
  const firstIndex = firstMatchIndex(matches);
  const prefix = lyricLine.slice(0, firstIndex);
  if (firstIndex <= 0 || !prefix.trim()) return [];
  return [{ chord: "", text: prefix.trimEnd(), spaceAfter: prefixHasTrailingSpace(prefix, firstIndex) }];
}

function firstMatchIndex(matches: ChordToken[]) {
  return matches[0]?.index ?? 0;
}

function prefixHasTrailingSpace(prefix: string, firstIndex: number) {
  return /\s+$/.test(prefix) || prefix.length < firstIndex;
}

function chordMatchToBlock(
  matches: ChordToken[],
  index: number,
  lyricLine: string,
): LyricBlock | null {
  const match = matches[index];
  if (!match) return null;

  const chord = match.chord;
  const textSegment = chordTextSegment(matches, index, lyricLine, match.index, chord.length);
  const text = textSegment.trimEnd();

  return {
    chord,
    text,
    spaceAfter: chordBlockSpaceAfter(textSegment, text, index, matches.length),
  };
}

function chordTextSegment(
  matches: ChordToken[],
  index: number,
  lyricLine: string,
  start: number,
  chordLength: number,
) {
  const end = matchEnd(matches[index + 1], lyricLine, start, chordLength);
  return start < lyricLine.length ? lyricLine.slice(start, end) : "";
}

function chordBlockSpaceAfter(textSegment: string, text: string, index: number, matchCount: number) {
  return /\s+$/.test(textSegment) || (text === "" && index < matchCount - 1);
}

function matchEnd(
  next: ChordToken | undefined,
  lyricLine: string,
  start: number,
  chordLength: number,
): number {
  return next
    ? next.index
    : Math.max(lyricLine.length, start + chordLength);
}
