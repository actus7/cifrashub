import { describe, expect, it } from "vitest";
import { replaceSongByArrangement } from "@/lib/replace-song-by-arrangement";
import type { StoredSong } from "@/lib/types";

function makeSong(id: string, arrangementId?: string): StoredSong {
  return {
    id,
    arrangementId,
    title: `Song ${id}`,
    artist: "Artist",
    artistSlug: "artist",
    slug: `song-${id}`,
    songData: [],
  };
}

describe("replaceSongByArrangement", () => {
  it("replaces a song with matching arrangement key in place", () => {
    const existing = makeSong("1", "arr-a");
    const other = makeSong("2", "arr-b");
    const replacement = makeSong("1", "arr-a");

    const result = replaceSongByArrangement([existing, other], replacement);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(replacement);
    expect(result[1]).toBe(other);
  });

  it("prepends the song when no matching arrangement key is found", () => {
    const existing = makeSong("1", "arr-a");
    const newcomer = makeSong("3", "arr-c");

    const result = replaceSongByArrangement([existing], newcomer);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(newcomer);
    expect(result[1]).toBe(existing);
  });

  it("uses id as fallback when arrangementId is absent", () => {
    const existing = makeSong("1");
    const replacement = makeSong("1");

    const result = replaceSongByArrangement([existing], replacement);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(replacement);
  });

  it("handles an empty song list by prepending", () => {
    const song = makeSong("1", "arr-a");

    const result = replaceSongByArrangement([], song);

    expect(result).toEqual([song]);
  });

  it("replaces only the matching entry when multiple songs exist", () => {
    const a = makeSong("1", "arr-a");
    const b = makeSong("2", "arr-b");
    const c = makeSong("3", "arr-c");
    const replacement = makeSong("2", "arr-b");

    const result = replaceSongByArrangement([a, b, c], replacement);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(replacement);
    expect(result[2]).toBe(c);
  });
});
