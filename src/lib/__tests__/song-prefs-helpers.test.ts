import { describe, expect, it } from "vitest";
import {
  arePrefsEqual,
  applyPrefsToFolders,
  applyPrefsToRecentes,
  playerPrefs,
  uiPrefs,
  withPlayerPrefs,
  type PersistedPlayerPrefs,
  type PlayerPrefsSource,
} from "@/app/song/[artistSlug]/[slug]/_lib/song-prefs-helpers";
import { PLAYER_PREF_DEFAULTS } from "@/lib/player-pref-defaults";
import type { Folder, StoredSong } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSong(id: string, overrides?: Partial<StoredSong>): StoredSong {
  return {
    id,
    title: `Song ${id}`,
    artist: "Artist",
    artistSlug: "artist",
    slug: `song-${id}`,
    songData: [],
    ...overrides,
  };
}

function makePrefsSource(overrides?: Partial<PlayerPrefsSource>): PlayerPrefsSource {
  return { ...PLAYER_PREF_DEFAULTS, ...overrides };
}

function makeFolder(id: string, songs: StoredSong[]): Folder {
  return { id, title: `Folder ${id}`, songs };
}

// ── playerPrefs ──────────────────────────────────────────────────────────────

describe("playerPrefs", () => {
  it("extracts all player pref keys from a source object", () => {
    const source = makePrefsSource({ tone: 3, capo: 2, simplified: true });
    const prefs = playerPrefs(source);

    expect(prefs.tone).toBe(3);
    expect(prefs.capo).toBe(2);
    expect(prefs.simplified).toBe(true);
    expect(prefs.showTabs).toBe(true); // default
  });
});

// ── uiPrefs ──────────────────────────────────────────────────────────────────

describe("uiPrefs", () => {
  it("excludes tone and capo from the result", () => {
    const source = makePrefsSource({ tone: 5, capo: 3 });
    const prefs = uiPrefs(source);

    expect(prefs).not.toHaveProperty("tone");
    expect(prefs).not.toHaveProperty("capo");
    expect(prefs.simplified).toBe(false);
  });
});

// ── withPlayerPrefs ──────────────────────────────────────────────────────────

describe("withPlayerPrefs", () => {
  it("merges prefs into a song, overriding matching keys", () => {
    const song = makeSong("1", { tone: 0, capo: 0 });
    const prefs: PersistedPlayerPrefs = { ...PLAYER_PREF_DEFAULTS, tone: 2, capo: 1 };

    const result = withPlayerPrefs(song, prefs);

    expect(result.tone).toBe(2);
    expect(result.capo).toBe(1);
    expect(result.id).toBe("1"); // preserved
  });
});

// ── arePrefsEqual ────────────────────────────────────────────────────────────

describe("arePrefsEqual", () => {
  it("returns true when all prefs match", () => {
    const song = makeSong("1", { tone: 0, capo: 0, simplified: false });
    const prefs: PersistedPlayerPrefs = { ...PLAYER_PREF_DEFAULTS };

    expect(arePrefsEqual(song, prefs)).toBe(true);
  });

  it("returns false when any pref differs", () => {
    const song = makeSong("1", { tone: 0, capo: 0 });
    const prefs: PersistedPlayerPrefs = { ...PLAYER_PREF_DEFAULTS, tone: 3 };

    expect(arePrefsEqual(song, prefs)).toBe(false);
  });

  it("uses defaults for missing song properties", () => {
    const song = makeSong("1"); // no tone/capo set → undefined
    const prefs: PersistedPlayerPrefs = { ...PLAYER_PREF_DEFAULTS }; // tone: 0, capo: 0

    // song.tone is undefined, default is 0, prefs.tone is 0 → equal
    expect(arePrefsEqual(song, prefs)).toBe(true);
  });

  it("detects difference when song has undefined and prefs have non-default", () => {
    const song = makeSong("1"); // tone undefined → default 0
    const prefs: PersistedPlayerPrefs = { ...PLAYER_PREF_DEFAULTS, tone: 2 };

    expect(arePrefsEqual(song, prefs)).toBe(false);
  });
});

// ── applyPrefsToRecentes ─────────────────────────────────────────────────────

describe("applyPrefsToRecentes", () => {
  it("replaces the matching song and prepends it", () => {
    const existing = makeSong("1", { tone: 0 });
    const other = makeSong("2", { tone: 0 });
    const updated = makeSong("1", { tone: 3 });

    const result = applyPrefsToRecentes([existing, other], "1", updated);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(updated);
    expect(result[1]).toBe(other);
  });

  it("prepends when no matching song is found", () => {
    const existing = makeSong("1");
    const newcomer = makeSong("3", { tone: 5 });

    const result = applyPrefsToRecentes([existing], "3", newcomer);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(newcomer);
    expect(result[1]).toBe(existing);
  });

  it("handles an empty list", () => {
    const song = makeSong("1", { tone: 2 });

    const result = applyPrefsToRecentes([], "1", song);

    expect(result).toEqual([song]);
  });

  it("caps at 15 entries", () => {
    const songs = Array.from({ length: 15 }, (_, i) => makeSong(String(i)));
    const updated = makeSong("0", { tone: 7 });

    const result = applyPrefsToRecentes(songs, "0", updated);

    expect(result).toHaveLength(15);
    expect(result[0]).toBe(updated);
  });

  it("matches by artistSlug-slug when id is empty", () => {
    const existing = makeSong("", { artistSlug: "band", slug: "track" });
    const updated = makeSong("", { artistSlug: "band", slug: "track", tone: 4 });

    const result = applyPrefsToRecentes([existing], "band-track", updated);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(updated);
  });
});

// ── applyPrefsToFolders ──────────────────────────────────────────────────────

describe("applyPrefsToFolders", () => {
  it("updates matching songs across folders", () => {
    const song1 = makeSong("1", { tone: 0 });
    const song2 = makeSong("2", { tone: 0 });
    const folders = [makeFolder("f1", [song1]), makeFolder("f2", [song2])];
    const prefs: PersistedPlayerPrefs = { ...PLAYER_PREF_DEFAULTS, tone: 3 };

    const result = applyPrefsToFolders(folders, "1", prefs);

    expect(result).not.toBe(folders); // new reference
    expect(result[0]!.songs[0]!.tone).toBe(3);
    expect(result[1]!.songs[0]!.tone).toBe(0); // untouched
  });

  it("returns the original reference when no song matches", () => {
    const song = makeSong("1");
    const folders = [makeFolder("f1", [song])];
    const prefs: PersistedPlayerPrefs = { ...PLAYER_PREF_DEFAULTS, tone: 5 };

    const result = applyPrefsToFolders(folders, "999", prefs);

    expect(result).toBe(folders); // same reference → no-op
  });

  it("handles empty folders", () => {
    const folders: Folder[] = [];
    const prefs: PersistedPlayerPrefs = { ...PLAYER_PREF_DEFAULTS };

    const result = applyPrefsToFolders(folders, "1", prefs);

    expect(result).toBe(folders); // same reference
  });

  it("updates the matching song and preserves others in the same folder", () => {
    const target = makeSong("1", { tone: 0 });
    const other = makeSong("2", { tone: 0 });
    const folders = [makeFolder("f1", [target, other])];
    const prefs: PersistedPlayerPrefs = { ...PLAYER_PREF_DEFAULTS, tone: 4 };

    const result = applyPrefsToFolders(folders, "1", prefs);

    expect(result[0]!.songs[0]!.tone).toBe(4);
    expect(result[0]!.songs[1]!.tone).toBe(0);
  });
});
