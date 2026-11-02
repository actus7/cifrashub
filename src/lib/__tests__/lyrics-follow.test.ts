import { describe, expect, it } from "vitest";
import { matchLine, normalizeWords } from "../lyrics-follow";

const LYRICS = [
  "Vamos, louve ao Senhor",
  "Ei, meu coração",
  "Não se envergonhe, cante essa canção",
  "Pois sei que há fôlego nesses pulmões",
  "Aleluia, aleluia",
  "É um aleluia, aleluia",
  "Sei que é simples pra um rei",
  "Aleluia, aleluia",
  "É um aleluia, aleluia",
].map(normalizeWords);

const heard = (text: string) => normalizeWords(text);

describe("normalizeWords", () => {
  it("strips accents, punctuation and case", () => {
    expect(normalizeWords("Não se envergonhe, CANTE!")).toEqual(["nao", "se", "envergonhe", "cante"]);
  });
});

describe("matchLine", () => {
  it("finds the exact line being sung", () => {
    expect(matchLine(LYRICS, heard("não se envergonhe cante essa canção"), 0)).toBe(2);
  });

  it("tolerates recognition errors", () => {
    expect(matchLine(LYRICS, heard("pois sei que a folga nesses pulmões"), 2)).toBe(3);
  });

  it("advances to the next repeat of the chorus instead of jumping back", () => {
    expect(matchLine(LYRICS, heard("é um aleluia aleluia"), 6)).toBe(8);
  });

  it("stays on the current line for unrelated speech", () => {
    expect(matchLine(LYRICS, heard("galera bora mais uma"), 3)).toBe(3);
  });

  it("jumps far only when the match is strong", () => {
    expect(matchLine(LYRICS, heard("vamos louve ao senhor"), 8)).toBe(0);
  });
});
