// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isChordText, processHtmlAndExtract } from "@/lib/parser";
import { parseChordLinePair } from "@/lib/parse-chord-line-pair";

const html = fs.readFileSync(path.join(__dirname, "fixtures", "cifra-basic.html"), "utf8");
const song = () => processHtmlAndExtract(html, "id1", "T", "A", "artist", "song-title");
const chordsOf = (sectionIdx: number) =>
  song().songData[sectionIdx]!.content.flatMap((l) => l.map((b) => b.chord).filter(Boolean));

describe("processHtmlAndExtract", () => {
  it("returns title, artist and non-empty songData", () => {
    const s = song();
    expect(s.title).toBe("Song Title");
    expect(s.artist).toBe("Artist");
    expect(s.songData.length).toBeGreaterThan(0);
  });

  it("keeps section labels in order", () => {
    expect(song().songData.map((s) => s.label)).toEqual(["[Intro]", "[Refrão]"]);
  });

  it("extracts plain chords G, D, Em", () => {
    expect(chordsOf(0)).toEqual(["G", "D", "Em"]);
  });

  it("parses sharps, 7M and extensions", () => {
    expect(chordsOf(1)).toEqual(["F#m", "D/F#", "C7M", "Am7(9)"]);
  });
});

describe("isChordText", () => {
  it.each(["C7M", "F#m", "D/F#", "Am7(9)", "(2x)"])("true for %s", (t) => {
    expect(isChordText(t)).toBe(true);
  });
  it.each(["Tom:", "Afinação", "amor"])("false for %s", (t) => {
    expect(isChordText(t)).toBe(false);
  });
});

describe("parseChordLinePair", () => {
  it("records block shape", () => {
    expect(parseChordLinePair("G       D", "Hello world friend")).toMatchInlineSnapshot(`
      [
        {
          "chord": "G",
          "spaceAfter": false,
          "text": "Hello wo",
        },
        {
          "chord": "D",
          "spaceAfter": false,
          "text": "rld friend",
        },
      ]
    `);
  });
});
