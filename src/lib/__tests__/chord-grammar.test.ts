import { describe, expect, it } from "vitest";
import { findChordTokens } from "@/lib/chord-grammar";

const chords = (line: string) => findChordTokens(line).map((t) => t.chord);

describe("findChordTokens", () => {
  it.each([
    ["F#", ["F#"]],
    ["D/F#", ["D/F#"]],
    ["C7M  G", ["C7M", "G"]],
    ["Am7(9)", ["Am7(9)"]],
    ["C°  C+", ["C°", "C+"]],
    ["A7/C#   Bb", ["A7/C#", "Bb"]],
    ["G  D  Em", ["G", "D", "Em"]],
    ["E o amor", ["E"]],
  ])("finds chords in %j", (line, expected) => {
    expect(chords(line)).toEqual(expected);
  });

  it("reports column indices", () => {
    expect(findChordTokens("G    D").map((t) => t.index)).toEqual([0, 5]);
  });
});
