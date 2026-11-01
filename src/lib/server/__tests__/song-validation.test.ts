import { describe, expect, it } from "vitest";
import {
  MAX_LINES_PER_SECTION,
  MAX_SECTIONS,
  MAX_TITLE,
  sanitizeUiPrefs,
  validateStoredSong,
} from "@/lib/server/song-validation";

const song = (over: Record<string, unknown> = {}) => ({
  id: "a",
  title: "T",
  artist: "A",
  artistSlug: "a",
  slug: "t",
  songData: [{ type: "verse", label: "v", content: [[{ chord: "C", text: "x" }]] }],
  ...over,
});

describe("validateStoredSong", () => {
  it("accepts a valid song", () => {
    expect(validateStoredSong(song()).ok).toBe(true);
  });
  it("rejects non-objects", () => {
    expect(validateStoredSong(null).ok).toBe(false);
  });
  it("rejects empty title", () => {
    expect(validateStoredSong(song({ title: " " })).ok).toBe(false);
  });
  it("rejects too long title", () => {
    expect(validateStoredSong(song({ title: "x".repeat(MAX_TITLE + 1) })).ok).toBe(false);
  });
  it("rejects too many sections", () => {
    const s = { type: "verse", label: "v", content: [] };
    expect(validateStoredSong(song({ songData: Array(MAX_SECTIONS + 1).fill(s) })).ok).toBe(false);
  });
  it("rejects too many lines", () => {
    const content = Array(MAX_LINES_PER_SECTION + 1).fill([]);
    expect(validateStoredSong(song({ songData: [{ type: "verse", label: "v", content }] })).ok).toBe(false);
  });
  it("rejects malformed blocks", () => {
    const bad = [{ type: "verse", label: "v", content: [[{ chord: 1, text: "x" }]] }];
    expect(validateStoredSong(song({ songData: bad })).ok).toBe(false);
  });
  it("rejects oversized songData", () => {
    const big = [{ type: "verse", label: "v", content: [[{ chord: "", text: "x".repeat(600 * 1024) }]] }];
    expect(validateStoredSong(song({ songData: big })).ok).toBe(false);
  });
  it("rejects out-of-range tone/capo", () => {
    expect(validateStoredSong(song({ tone: 99 })).ok).toBe(false);
    expect(validateStoredSong(song({ capo: 13 })).ok).toBe(false);
  });
});

describe("sanitizeUiPrefs", () => {
  it("rejects arrays", () => {
    expect(sanitizeUiPrefs([1])).toBeNull();
  });
  it("drops unknown keys and clamps bpm", () => {
    expect(sanitizeUiPrefs({ bpm: 9999, evil: 1, zenMode: true })).toEqual({ bpm: 300, zenMode: true });
    expect(sanitizeUiPrefs({ bpm: 0 })).toEqual({ bpm: 20 });
  });
});
