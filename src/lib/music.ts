import type { SectionType } from "./types";

const NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  Cb: "B",
  Db: "C#",
  Eb: "D#",
  Fb: "E",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

/** Raiz de tom (ex.: G, F#) como no JSON do Cifra Club. */
function normalizeKeyRoot(root: string): string {
  const t = root.trim();
  return FLAT_TO_SHARP[t] ?? t;
}

/** Tom efetivo ao usar capotraste: sobe semitons a partir da raiz escrita. */
export function transposeRootNote(root: string, semitones: number): string {
  const r = normalizeKeyRoot(root);
  if (semitones === 0) return r;
  const index = NOTES.indexOf(r as (typeof NOTES)[number]);
  if (index === -1) return r;
  let newIndex = (index + semitones) % 12;
  if (newIndex < 0) newIndex += 12;
  return NOTES[newIndex];
}

export function normalizeChord(chord: string): string {
  return chord.replace(/[A-G]b/g, (match) => FLAT_TO_SHARP[match] ?? match);
}

export function transposeChord(chord: string, steps: number): string {
  if (!chord || steps === 0) return chord;
  return normalizeChord(chord)
    .split("/")
    .map((part) => {
      return part.replace(/^[A-G][#]?/, (match) => {
        const index = NOTES.indexOf(match as (typeof NOTES)[number]);
        if (index === -1) return match;
        let newIndex = (index + steps) % 12;
        if (newIndex < 0) newIndex += 12;
        return NOTES[newIndex];
      });
    })
    .join("/");
}

function isMinorKey(key: string): boolean {
  return key.endsWith("m") && !key.endsWith("dim");
}

function keyRoot(key: string): string {
  return isMinorKey(key) ? key.slice(0, -1) : key;
}

/**
 * Calcula estado do toggle relativo maior/menor.
 * Retorna o tom destino e os labels para o botão.
 */
function normalizeSemitone(value: number): number {
  return ((value % 12) + 12) % 12;
}

function relativeBackLabel(writtenKey: string, minor: boolean): string {
  const root = transposeRootNote(keyRoot(writtenKey), 0);
  return minor ? `Voltar p/ Menor (${root}m)` : `Voltar p/ Maior (${root})`;
}

function relativeTargetLabel(targetNote: string, minor: boolean): string {
  return minor ? `Relativo Maior (${targetNote})` : `Relativo Menor (${targetNote}m)`;
}

function relativeOffset(minor: boolean) {
  return minor ? 3 : -3;
}

function relativeToggleLabel(writtenKey: string, minor: boolean, isAtRelative: boolean, targetNote: string) {
  return isAtRelative
    ? relativeBackLabel(writtenKey, minor)
    : relativeTargetLabel(targetNote, minor);
}

export function getRelativeKeyToggle(
  writtenKey: string,
  tone: number,
): { targetTone: number; isAtRelative: boolean; label: string } {
  const minor = isMinorKey(writtenKey);
  const offset = relativeOffset(minor);
  const isAtRelative = normalizeSemitone(tone) === normalizeSemitone(offset);
  const targetTone = isAtRelative ? 0 : offset;
  const currentKey = transposeRootNote(keyRoot(writtenKey), isAtRelative ? 0 : tone);
  const targetNote = transposeRootNote(currentKey, isAtRelative ? -offset : offset);

  return {
    targetTone,
    isAtRelative,
    label: relativeToggleLabel(writtenKey, minor, isAtRelative, targetNote),
  };
}

export function simplifyChord(chord: string): string {
  const simple = baseChord(chord);
  return simple ? simplifiedChordName(simple) : "";
}

function baseChord(chord: string) {
  return chord.split("/")[0] ?? "";
}

function simplifiedChordName(chord: string) {
  const match = chord.match(/^([A-G][#b]?)(m(?!aj))?/);
  return match ? `${match[1]}${match[2] ?? ""}` : chord;
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const;
const ACCIDENTAL_LABELS: Record<number, string> = {
  [-1]: "b",
  0: "",
  1: "#",
};

function noteIndex(note: string) {
  return NOTES.indexOf(normalizeKeyRoot(note) as (typeof NOTES)[number]);
}

function chordParts(chord: string) {
  return chord.match(/^([A-G][#b]?)(.*)$/);
}

function degreeFromInterval(interval: number) {
  const normalized = normalizeSemitone(interval);
  for (const accidental of [0, -1, 1]) {
    const degreeIndex = MAJOR_SCALE.findIndex((degree) => normalizeSemitone(degree + accidental) === normalized);
    if (degreeIndex !== -1) return `${ACCIDENTAL_LABELS[accidental]}${degreeIndex + 1}`;
  }
  return undefined;
}

function chordQuality(suffix: string) {
  if (/^(°|dim)/i.test(suffix)) return "°";
  if (/^m(?!aj)/.test(suffix)) return "m";
  return "";
}

function chordRootToNashville(root: string, key: string) {
  const rootIndex = noteIndex(root);
  const keyIndex = noteIndex(keyRoot(key));
  if (rootIndex === -1 || keyIndex === -1) return undefined;
  return degreeFromInterval(rootIndex - keyIndex);
}

function chordPartToNashville(part: string, key: string, includeQuality: boolean) {
  const match = chordParts(part);
  if (!match) return part;
  const degree = chordRootToNashville(match[1], key);
  if (!degree) return part;
  return `${degree}${includeQuality ? chordQuality(match[2] ?? "") : ""}`;
}

export function chordToNashville(chord: string, key: string): string {
  if (!chord || !key) return chord;
  const [base, bass] = normalizeChord(chord).split("/");
  if (!base) return chord;
  const nashvilleBase = chordPartToNashville(base, key, true);
  if (!bass) return nashvilleBase;
  return `${nashvilleBase}/${chordPartToNashville(bass, key, false)}`;
}

const SECTION_MATCHERS: Array<[RegExp, SectionType]> = [
  [/intro/, "intro"],
  [/pr[eé].?refr[aã]o|pre.?chorus/, "pre-chorus"],
  [/vers[oõ]|parte|estrofe/, "verse"],
  [/refr[aã]o|chorus/, "chorus"],
  [/ponte|bridge/, "bridge"],
  [/tab\b/, "tab"],
  [/solo/, "solo"],
  [/final|outro/, "outro"],
];

export function classifySection(label: string): SectionType {
  const lower = label.toLowerCase();
  return SECTION_MATCHERS.find(([pattern]) => pattern.test(lower))?.[1] ?? "verse";
}
