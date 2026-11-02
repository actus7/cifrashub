import { describe, expect, it } from "vitest";
import { parseRepeat, repeatEdges, stripRepeat } from "../repeat-marks";

describe("parseRepeat", () => {
  it.each([
    ["Aleluia, aleluia (2x)", 2],
    ["Aleluia, aleluia 2x", 2],
    ["Vem, Espírito (4X)", 4],
    ["Santo, santo x3", 3],
    ["Refrão (3 vezes)", 3],
    ["[Refrão 2x]", 2],
    ["(2x)", 2],
  ])("reads %s as %i", (text, n) => {
    expect(parseRepeat(text)).toBe(n);
  });

  it.each(["Meu coração", "Exalte o Rei", "Salmo 23", "Ele é o 1x de nós e mais", "(1x)"])("ignores %s", (text) => {
    expect(parseRepeat(text)).toBeNull();
  });
});

describe("stripRepeat", () => {
  it("removes the mark but keeps the lyric", () => {
    expect(stripRepeat("Aleluia, aleluia (2x)")).toBe("Aleluia, aleluia");
    expect(stripRepeat("Santo, santo x3")).toBe("Santo, santo");
    expect(stripRepeat("Meu coração")).toBe("Meu coração");
  });
});

describe("repeatEdges", () => {
  it("a marked line can repeat itself or its stanza; a marked section repeats as a whole", () => {
    const rows = [
      { repeat: null, section: 0, sectionRepeat: null },
      { repeat: null, section: 0, sectionRepeat: null },
      { repeat: 2, section: 0, sectionRepeat: null }, // "(2x)" no fim da estrofe
      { repeat: null, section: 1, sectionRepeat: 2 }, // [Refrão 2x]
      { repeat: null, section: 1, sectionRepeat: 2 },
    ];
    expect(repeatEdges(rows)).toEqual([
      { from: 2, to: 2 },
      { from: 2, to: 0 },
      { from: 4, to: 3 },
    ]);
  });

  it("in a long block without blank lines, a marked line repeats only itself (never back to the song start)", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ repeat: i === 34 ? 2 : null, section: 1, sectionRepeat: null }));
    expect(repeatEdges(rows)).toEqual([{ from: 34, to: 34 }]);
  });
});
