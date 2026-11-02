import { describe, expect, it } from "vitest";
import { matchLine, normalizeWords, similarWords } from "../lyrics-follow";
import GRATIDAO from "./fixtures/gratidao-lyrics.json";

const LINES = (GRATIDAO as string[]).map(normalizeWords);

/** "Canta" a letra palavra por palavra (com ruído opcional) e conta em quantas linhas a posição estava certa no fim. */
function follow(noise: (word: string, i: number) => string | null = (w) => w): number {
  let current = -1;
  const heard: string[] = [];
  let correct = 0;
  let n = 0;
  LINES.forEach((line, idx) => {
    for (const w of line) {
      const r = noise(w, n++);
      if (r) heard.push(r);
      current = matchLine(LINES, heard, current);
    }
    if (current === idx) correct++;
  });
  return correct;
}

describe("normalizeWords", () => {
  it("strips accents, punctuation and case", () => {
    expect(normalizeWords("Não se envergonhe, CANTE!")).toEqual(["nao", "se", "envergonhe", "cante"]);
  });
});

describe("similarWords", () => {
  it("accepts recognition slips and rejects different words", () => {
    expect(similarWords("folego", "folga")).toBe(true);
    expect(similarWords("cancao", "cancoes")).toBe(true);
    expect(similarWords("louvar", "levantar")).toBe(false);
    expect(similarWords("rei", "reis")).toBe(false);
  });
});

describe("matchLine on a real song (Gratidão)", () => {
  it("follows every line with clean recognition", () => {
    expect(follow()).toBe(LINES.length);
  });

  it("keeps following when the recognizer drops 1 in 4 words", () => {
    // Medido: 45/60 (o algoritmo anterior: 31/60). Linhas como "aleluia, aleluia" com 1 palavra ouvida não têm
    // evidência suficiente de que começaram.
    expect(follow((w, i) => (i % 4 === 3 ? null : w))).toBeGreaterThanOrEqual(LINES.length * 0.7);
  });

  it("keeps following when the recognizer mishears words", () => {
    expect(follow((w, i) => (i % 3 === 2 ? w.slice(0, -1) + "x" : w))).toBeGreaterThanOrEqual(LINES.length * 0.85);
  });

  it("stays on the line while it is being sung and for unrelated speech", () => {
    const at = LINES.findIndex((l) => l.join(" ") === "pois sei que ha folego nesses pulmoes");
    expect(matchLine(LINES, normalizeWords("pois sei que ha folego"), at)).toBe(at);
    expect(matchLine(LINES, normalizeWords("galera bora mais uma"), at)).toBe(at);
  });

  it("moves to the next repeat of the chorus, not back to an earlier one", () => {
    const repeats = LINES.flatMap((l, i) => (l.join(" ") === "ei meu coracao" ? [i] : []));
    expect(repeats.length).toBeGreaterThan(1);
    const next = matchLine(LINES, normalizeWords("vamos louve ao senhor ei meu coracao"), repeats[0] + 3);
    expect(next).toBe(repeats[1]);
  });

  it("finds the chorus within 3 words when the singer starts there, even with a dropped word", () => {
    const chorus = LINES.findIndex((l) => l.join(" ") === "ei meu coracao");
    expect(matchLine(LINES, normalizeWords("ei meu coracao"), -1)).toBe(chorus);
    expect(matchLine(LINES, normalizeWords("ei coracao"), -1)).toBe(chorus);
  });
});
