/** Matches plausible chord text like C7M, Am7, Bm7, Em, E5, D5, Bm, (passagem) */
const CHORD_TEXT_RE = /^[A-G(#][#b♯♭]?(?:M|maj|min|m|dim|aug|sus|add|º|°|\+|\^|\/[A-G]?[#b♯♭]?|-|\(|\)|\d|\s|\.|,|…|'|"){0,20}$/;

/**
 * Tests whether text content of a `<b>` tag looks like a chord rather than
 * metadata (e.g. "Tom:", "Afinação:"). Used to guard chord-marker replacement.
 */
export function isChordText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Parenthetical annotations like (passagem), (2x), etc.
  if (/^\(.*\)$/.test(t)) return true;
  // Must start with a note letter
  if (!/^[A-G]/.test(t)) return false;
  return CHORD_TEXT_RE.test(t);
}

/** A single whitespace-free token that is a chord (no parenthetical-only annotations). */
export function isChordToken(token: string): boolean {
  return /^[A-G]/.test(token) && !/\s/.test(token) && CHORD_TEXT_RE.test(token);
}

export interface ChordToken {
  chord: string;
  index: number;
}

export function findChordTokens(line: string): ChordToken[] {
  const tokens: ChordToken[] = [];
  for (const m of line.matchAll(/\S+/g)) {
    if (isChordToken(m[0])) tokens.push({ chord: m[0], index: m.index });
  }
  return tokens;
}
