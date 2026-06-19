import { describe, expect, it } from "vitest";
import {
  chordToNashville,
  classifySection,
  getRelativeKeyToggle,
  normalizeChord,
  simplifyChord,
  transposeChord,
  transposeRootNote,
} from "@/lib/music";

describe("music utilities", () => {
  it("transposes root notes with sharps and flats", () => {
    expect(transposeRootNote("C", 2)).toBe("D");
    expect(transposeRootNote("Bb", 2)).toBe("C");
    expect(transposeRootNote("C", -1)).toBe("B");
    expect(transposeRootNote("H", 2)).toBe("H");
  });

  it("normalizes and transposes chord names", () => {
    expect(normalizeChord("Bb/D")).toBe("A#/D");
    expect(transposeChord("Am/G", 2)).toBe("Bm/A");
    expect(transposeChord("Bbmaj7/F", 2)).toBe("Cmaj7/G");
    expect(transposeChord("", 5)).toBe("");
  });

  it("calculates relative key toggle labels", () => {
    expect(getRelativeKeyToggle("Am", 0)).toEqual({
      targetTone: 3,
      isAtRelative: false,
      label: "Relativo Maior (C)",
    });
    expect(getRelativeKeyToggle("C", -3)).toEqual({
      targetTone: 0,
      isAtRelative: true,
      label: "Voltar p/ Maior (C)",
    });
  });

  it("converts chords to Nashville numbers", () => {
    expect(chordToNashville("C", "C")).toBe("1");
    expect(chordToNashville("Dm", "C")).toBe("2m");
    expect(chordToNashville("Em", "C")).toBe("3m");
    expect(chordToNashville("F", "C")).toBe("4");
    expect(chordToNashville("G", "C")).toBe("5");
    expect(chordToNashville("Am", "C")).toBe("6m");
    expect(chordToNashville("B°", "C")).toBe("7°");
    expect(chordToNashville("F#°", "G")).toBe("7°");
    expect(chordToNashville("Bb", "F")).toBe("4");
    expect(chordToNashville("D/F#", "G")).toBe("5/7");
    expect(chordToNashville("Cmaj7", "C")).toBe("1maj7");
    expect(chordToNashville("Fmaj7", "C")).toBe("4maj7");
    expect(chordToNashville("G7", "C")).toBe("57");
    expect(chordToNashville("Fsus4", "C")).toBe("4sus4");
    expect(chordToNashville("Dm7", "C")).toBe("2m7");
  });

  it("simplifies chords and classifies sections", () => {
    expect(simplifyChord("F#m7/C#")).toBe("F#m");
    expect(simplifyChord("Bbmaj7")).toBe("Bb");
    expect(classifySection("Pré-Refrão")).toBe("pre-chorus");
    expect(classifySection("Solo final")).toBe("solo");
    expect(classifySection("Parte 1")).toBe("verse");
  });
});
