import { describe, expect, it } from "vitest";
import { neighbors, songHref } from "@/lib/setlist-navigation";
import type { SetlistItemView, StoredSong } from "@/lib/types";

const song = (slug: string) => ({ artistSlug: "art", slug }) as unknown as StoredSong;
const item = (position: number, s: StoredSong | null): SetlistItemView => ({
  itemId: `i${position}`,
  position,
  arrangementId: `a${position}`,
  notes: null,
  song: s,
});

describe("neighbors", () => {
  const items = [item(0, song("a")), item(1, null), item(2, song("c")), item(3, song("d"))];

  it("has no prev on first item", () => {
    expect(neighbors(items, 0).prev).toBeNull();
    expect(neighbors(items, 0).next?.position).toBe(2);
  });
  it("has no next on last item", () => {
    expect(neighbors(items, 3).next).toBeNull();
    expect(neighbors(items, 3).prev?.position).toBe(2);
  });
  it("skips items with null songs", () => {
    expect(neighbors(items, 2).prev?.position).toBe(0);
  });
});

describe("songHref", () => {
  it("includes setlist, pos and ownerId when given", () => {
    const href = songHref(song("x"), { setlistId: "s1", position: 4, ownerId: "o1" });
    expect(href).toContain("/song/art/x?");
    expect(href).toContain("setlist=s1");
    expect(href).toContain("pos=4");
    expect(href).toContain("ownerId=o1");
  });
  it("omits ownerId otherwise", () => {
    expect(songHref(song("x"), { setlistId: "s1", position: 0 })).not.toContain("ownerId");
  });
});
