import { describe, expect, it } from "vitest";
import { prefsUpdateSet } from "../prefs-update";
import type { StoredSong } from "@/lib/types";

const prefs = { arrangementId: "a1", tone: 2, capo: 1, uiPrefs: null };
const song = { title: "t", artist: "a", songData: [{ x: 1 }] } as unknown as StoredSong;
const now = new Date(0);

describe("prefsUpdateSet", () => {
  it("omits songData for prefs-only updates even when a snapshot is sent", () => {
    const set = prefsUpdateSet(prefs, song, false, now);
    expect(set).toEqual({ tone: 2, capo: 1, uiPrefs: null, updatedAt: now });
    expect("songData" in set).toBe(false);
  });

  it("includes songData on explicit content sync", () => {
    expect(prefsUpdateSet(prefs, song, true, now).songData).toBe(song.songData);
  });

  it("omits songData on content sync without a valid snapshot", () => {
    expect("songData" in prefsUpdateSet(prefs, null, true, now)).toBe(false);
  });
});
