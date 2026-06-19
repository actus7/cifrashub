import { describe, expect, it } from "vitest";
import { arrangementKey } from "@/lib/arrangement-key";
import { dedupeRecentesBySong } from "@/lib/dedupe-recentes-by-song";
import { flattenLibrarySongs } from "@/lib/library-flat";
import { songIdentityKey } from "@/lib/song-identity-key";
import type { Folder, StoredSong } from "@/lib/types";

const song = (overrides: Partial<StoredSong>): StoredSong => ({
  id: "song-1",
  arrangementId: "arr-1",
  title: "Song",
  artist: "Artist",
  artistSlug: "artist",
  slug: "song",
  songData: [],
  ...overrides,
});

describe("song identity utilities", () => {
  it("prefers persistent ids and falls back to artist and slug", () => {
    expect(songIdentityKey(song({ id: " saved-id " }))).toBe("saved-id");
    expect(songIdentityKey({ id: "", artistSlug: "artist", slug: "song" })).toBe("artist-song");
    expect(songIdentityKey(null)).toBe("");
  });

  it("uses arrangement id when available", () => {
    expect(arrangementKey(song({ id: "id", arrangementId: "arr" }))).toBe("arr");
    expect(arrangementKey(song({ id: "id", arrangementId: undefined }))).toBe("id");
  });

  it("deduplicates recent songs by identity", () => {
    const result = dedupeRecentesBySong([
      song({ id: "1", slug: "one" }),
      song({ id: "1", slug: "duplicate" }),
      song({ id: "", artistSlug: "artist", slug: "two" }),
      song({ id: "", artistSlug: "artist", slug: "two", title: "Duplicate" }),
    ]);

    expect(result.map((item) => item.title)).toEqual(["Song", "Song"]);
  });

  it("flattens folders and recent songs by arrangement", () => {
    const folderSong = song({ id: "folder", arrangementId: "same", title: "Folder" });
    const recentSong = song({ id: "recent", arrangementId: "same", title: "Recent" });
    const folders: Folder[] = [{ id: "f1", title: "Favoritos", songs: [folderSong] }];

    expect(flattenLibrarySongs(folders, [recentSong])).toEqual([recentSong]);
  });

  it("keeps local setlist positions when building details", async () => {
    const { buildLocalSetlistDetail } = await import("@/lib/setlist-local");
    const first = song({ id: "first", arrangementId: "first", title: "First" });
    const second = song({ id: "second", arrangementId: "second", title: "Second" });

    const detail = buildLocalSetlistDetail(
      {
        id: "setlist",
        title: "Setlist",
        items: [
          { itemId: "first", arrangementId: "first", position: 1 },
          { itemId: "second", arrangementId: "second", position: 0 },
        ],
      },
      [{ id: "f1", title: "Favoritos", songs: [first, second] }],
      [],
    );

    expect(detail.items.map((item) => item.position)).toEqual([1, 0]);
  });
});
