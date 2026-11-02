import { describe, expect, it } from "vitest";
import {
  dedupeSongsByArrangement,
  planRecentTrim,
} from "@/lib/server/recent-songs";
import type { StoredSong } from "@/lib/types";

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ arrangementId: `a${i}`, position: i }));

describe("planRecentTrim", () => {
  it("does nothing when under the max", () => {
    expect(planRecentTrim(rows(3), new Set(), 5)).toEqual({ deleteIds: [], unrecentIds: [] });
  });

  it("deletes overflow rows beyond max, ranked by position", () => {
    const shuffled = rows(5).reverse();
    expect(planRecentTrim(shuffled, new Set(), 3)).toEqual({
      deleteIds: ["a3", "a4"],
      unrecentIds: [],
    });
  });

  it("unrecents pinned overflow rows instead of deleting", () => {
    expect(planRecentTrim(rows(5), new Set(["a3"]), 3)).toEqual({
      deleteIds: ["a4"],
      unrecentIds: ["a3"],
    });
  });

  it("ignores pinned rows inside the window", () => {
    expect(planRecentTrim(rows(3), new Set(["a0"]), 3)).toEqual({ deleteIds: [], unrecentIds: [] });
  });
});

describe("dedupeSongsByArrangement", () => {
  const song = (id: string | undefined, arrangementId: string) =>
    ({ id, arrangementId, title: "t", artist: "a" }) as unknown as StoredSong;

  it("keeps the first song per arrangement", () => {
    const out = dedupeSongsByArrangement([song("1", "x"), song("2", "x"), song("3", "y")]);
    expect(out.map((s) => s.id)).toEqual(["1", "3"]);
  });

  it("drops songs without id when requireId is set", () => {
    const out = dedupeSongsByArrangement([song(undefined, "x"), song("2", "y")], { requireId: true });
    expect(out.map((s) => s.id)).toEqual(["2"]);
  });
});
