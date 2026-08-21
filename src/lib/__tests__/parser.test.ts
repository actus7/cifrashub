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

// ── New-format key extraction (from real HTML fragment) ──────────────────────

describe("new-format Tom extraction", () => {
  // Real fragment from Cifra Club new format (Tempo Perdido - Legião Urbana)
  const tomFragment = `<div class="IERZz"><b>Tom<!-- -->: </b> <button type="button" class="eVroG" data-anchor="--chord-tone" style="--anchorName:--chord-tone">Em</button></div>`;

  it("extracts key from new-format button-based Tom element", () => {
    const m = tomFragment.match(/<b[^>]*>\s*Tom(?:\s*<!--\s*-->)?\s*:\s*<\/b>\s*(?:<[^>]*>)*\s*<button[^>]*>\s*([A-G][#b♯♭]?m?)\s*<\/button>/i);
    expect(m?.[1]).toBe("Em");
  });

  // Alternate pattern without HTML comment
  const tomFragmentNoComment = `<b>Tom: </b> <button type="button">G</button>`;

  it("extracts key without HTML comment", () => {
    const m = tomFragmentNoComment.match(/<b[^>]*>\s*Tom(?:\s*<!--\s*-->)?\s*:\s*<\/b>\s*(?:<[^>]*>)*\s*<button[^>]*>\s*([A-G][#b♯♭]?m?)\s*<\/button>/i);
    expect(m?.[1]).toBe("G");
  });

  // Minor key
  const tomFragmentMinor = `<b>Tom<!-- -->: </b> <button type="button">Am</button>`;

  it("extracts minor key", () => {
    const m = tomFragmentMinor.match(/<b[^>]*>\s*Tom(?:\s*<!--\s*-->)?\s*:\s*<\/b>\s*(?:<[^>]*>)*\s*<button[^>]*>\s*([A-G][#b♯♭]?m?)\s*<\/button>/i);
    expect(m?.[1]).toBe("Am");
  });
});

// ── Old-format key extraction (no regression) ────────────────────────────────

describe("old-format key extraction", () => {
  it("extracts key from urlAPI3 script block", () => {
    const html = `var cifra = {urlAPI3: "/api/v3", key: "E", chords: [1,2,3]};`;
    const block = html.match(/urlAPI3:\s*["'][^"']+["']([\s\S]{0,3500}?)chords:\s*\[/)?.[1] ?? html;
    const key = block.match(/key:\s*["']([A-G][#b]?)["']/)?.[1];
    expect(key).toBe("E");
  });

  it("extracts key from #cifra_tom div", () => {
    const html = `<div id="cifra_tom"><a href="/tom/G">G</a></div>`;
    const tomHtml = html.match(/id=["']cifra_tom["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const key = tomHtml?.match(/<a[^>]*>\s*([A-G][#b♯♭]?m?)\s*<\/a>/i)?.[1];
    expect(key).toBe("G");
  });

  it("extracts capo from #cifra_tom div", () => {
    const html = `<div id="cifra_tom">Capotraste na 2ª casa <a href="/tom/G">G</a></div>`;
    const tomHtml = html.match(/id=["']cifra_tom["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const capo = tomHtml?.match(/[Cc]apotraste\s+na\s+(\d+)/)?.[1];
    expect(capo).toBe("2");
  });
});

// ── Chord text regex validation ──────────────────────────────────────────────

describe("CHORD_TEXT_RE pattern", () => {
  // Inline copy of the regex for testing (same as in parser.ts)
  const CHORD_TEXT_RE = /^[A-G(#][#b♯♭]?(?:M|maj|min|m|dim|aug|sus|add|º|°|\+|\^|\/[A-G]?[#b♯♭]?|-|\(|\)|\d|\s|\.|,|…|'|"){0,20}$/;

  it("matches real chord examples from Cifra Club", () => {
    const chords = ["C7M", "Am7", "Bm7", "Em", "E5", "D5", "Bm", "C", "G", "D/F#"];
    for (const chord of chords) {
      expect(chord).toMatch(CHORD_TEXT_RE);
    }
  });

  it("does not match metadata text", () => {
    const metadata = ["Tom:", "Tom", "Afinação:", "Notas", "Capotraste"];
    for (const text of metadata) {
      expect(text).not.toMatch(CHORD_TEXT_RE);
    }
  });
});
