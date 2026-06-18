import { describe, expect, it } from "vitest";
import {
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

  it("simplifies chords and classifies sections", () => {
    expect(simplifyChord("F#m7/C#")).toBe("F#m");
    expect(simplifyChord("Bbmaj7")).toBe("Bb");
    expect(classifySection("Pré-Refrão")).toBe("pre-chorus");
    expect(classifySection("Solo final")).toBe("solo");
    expect(classifySection("Parte 1")).toBe("verse");
  });
});
