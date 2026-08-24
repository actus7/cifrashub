import { describe, expect, it } from "vitest";
import { preferredArrangementRow } from "@/lib/server/cloud-data";
import type { userSongs } from "@/db/schema";

type SongRow = typeof userSongs.$inferSelect;

function makeRow(id: string, overrides?: Partial<SongRow>): SongRow {
  return {
    id,
    userId: "user-1",
    folderId: null,
    songId: "song-1",
    arrangementId: "arr-1",
    sourceArtistSlug: null,
    sourceSlug: null,
    title: "Title",
    artist: "Artist",
    artistSlug: "artist",
    slug: "title",
    youtubeId: null,
    songData: [],
    tone: 0,
    capo: 0,
    uiPrefs: null,
    isRecent: false,
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("preferredArrangementRow", () => {
  it("prefers a row saved in a folder over a recent-only row", () => {
    const recent = makeRow("recent", { isRecent: true, folderId: null });
    const inFolder = makeRow("in-folder", { folderId: "folder-1" });

    expect(preferredArrangementRow([recent, inFolder])).toBe(inFolder);
    expect(preferredArrangementRow([inFolder, recent])).toBe(inFolder);
  });

  it("falls back to a recent row when no folder row exists", () => {
    const recent = makeRow("recent", { isRecent: true, folderId: null });
    const neither = makeRow("neither", { isRecent: false, folderId: null });

    expect(preferredArrangementRow([neither, recent])).toBe(recent);
  });

  it("falls back to the first row when nothing is in a folder or recent", () => {
    const first = makeRow("first");
    const second = makeRow("second");

    expect(preferredArrangementRow([first, second])).toBe(first);
  });

  it("returns undefined for an empty list", () => {
    expect(preferredArrangementRow([])).toBeUndefined();
  });
});
