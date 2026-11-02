import { describe, expect, it } from "vitest";
import { isChordText } from "@/lib/parser";

// ── isChordText ──────────────────────────────────────────────────────────────

describe("isChordText", () => {
  it.each([
    "C",
    "C7M",
    "Am7",
    "Bm7",
    "Em",
    "E5",
    "D5",
    "Bm",
    "G#",
    "Bb",
    "B♭",
    "F♯",
    "Cm",
    "Cmaj",
    "Cmin",
    "Cdim",
    "Caug",
    "Csus4",
    "Csus2",
    "Cadd9",
    "C/G",
    "Am7/G",
    "Cmaj7",
    "Cm7",
    "Cº",
    "C°",
    "C+",
    "C^",
    "C7",
    "C11",
    "C13",
    "Csus",
    "(passagem)",
  ])("accepts chord text: %s", (text) => {
    expect(isChordText(text)).toBe(true);
  });

  it.each([
    "",
    "Tom:",
    "Tom",
    "Afinação:",
    "Afinação",
    "Capotraste",
    "Notas",
    "hello world",
    "Some lyrics text",
    "123",
    "Intro",
    "Solo",
  ])("rejects non-chord text: %s", (text) => {
    expect(isChordText(text)).toBe(false);
  });

  it("rejects empty or whitespace-only strings", () => {
    expect(isChordText("")).toBe(false);
    expect(isChordText("   ")).toBe(false);
  });
});
