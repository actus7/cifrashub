import { describe, expect, it } from "vitest";
import {
  joinSectionPlainTexts,
  parsePlainTextCifra,
  sectionsToPlainText,
  sectionToPlainText,
} from "@/lib/parse-plain-cifra";

const parsed = (raw: string) => {
  const result = parsePlainTextCifra(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
};

describe("parsePlainTextCifra", () => {
  it("rejects empty input", () => {
    expect(parsePlainTextCifra("  \n\t")).toEqual({
      ok: false,
      error: "Digite o conteúdo da cifra.",
    });
  });

  it("parses section headers and aligned chord lyric pairs", () => {
    const sections = parsed("[Intro]\nG        D\nAmazing grace\n\n[Refrão]\nC\nFinal");

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ type: "intro", label: "[Intro]" });
    expect(sections[0]?.content[0]).toEqual([
      { chord: "G", text: "Amazing g", spaceAfter: false },
      { chord: "D", text: "race", spaceAfter: false },
    ]);
    expect(sections[1]).toMatchObject({ type: "chorus", label: "[Refrão]" });
  });

  it("parses explicit chord markers", () => {
    const sections = parsed("[Verso]\n‹CHORD:G›Olá ‹CHORD:D›mundo");

    expect(sections[0]?.content[0]).toEqual([
      { chord: "G", text: "Olá", spaceAfter: true },
      { chord: "D", text: "mundo", spaceAfter: false },
    ]);
  });

  it("preserves tab lines before cleaning blank endings", () => {
    const sections = parsed("[Tab]\ne|-----0-----|\n\n");

    expect(sections[0]).toMatchObject({ type: "tab", label: "[Tab]" });
    expect(sections[0]?.content).toEqual([
      [{ chord: "", text: "e|-----0-----|", isTab: true, spaceAfter: true }],
      [{ chord: "", text: "", spaceAfter: true }],
    ]);
  });
});

describe("plain text serialization", () => {
  it("serializes one section and multiple sections", () => {
    const sections = parsed("[Verso]\nG\nLet it be");

    expect(sectionToPlainText(sections[0]!)).toBe("[Verso]\nG\nLet it be");
    expect(sectionsToPlainText(sections)).toBe("[Verso]\nG\nLet it be");
    expect(joinSectionPlainTexts(["[A]\none", "[B]\ntwo"])).toBe("[A]\none\n\n[B]\ntwo");
  });
});
