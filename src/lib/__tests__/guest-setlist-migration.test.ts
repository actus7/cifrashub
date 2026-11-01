import { describe, expect, it, vi } from "vitest";
import { migrateGuestSetlists } from "@/lib/guest-setlist-migration";
import type { LocalSetlistStored } from "@/lib/types";

const sl = (id: string, arr: string[]): LocalSetlistStored => ({
  id,
  title: `T${id}`,
  description: null,
  items: arr.map((arrangementId) => ({ arrangementId })) as unknown as LocalSetlistStored["items"],
});

function deps(over: Record<string, unknown> = {}) {
  return {
    createSetlist: vi.fn(async () => ({ setlist: { id: "c1" } })),
    addItem: vi.fn(async () => undefined),
    save: vi.fn(),
    ...over,
  };
}

describe("migrateGuestSetlists", () => {
  it("removes setlist when all items migrate", async () => {
    const d = deps();
    const r = await migrateGuestSetlists([sl("a", ["x", "y"])], d);
    expect(r.partial).toEqual([]);
    expect(d.save).toHaveBeenLastCalledWith([]);
  });

  it("keeps only failed items and reports partial", async () => {
    const d = deps({
      addItem: vi.fn(async (_s: string, arr: string) => {
        if (arr === "y") throw new Error("nope");
      }),
    });
    const r = await migrateGuestSetlists([sl("a", ["x", "y"])], d);
    expect(r.partial).toEqual([{ title: "Ta", failedCount: 1 }]);
    const saved = d.save.mock.calls.at(-1)![0] as LocalSetlistStored[];
    expect(saved).toHaveLength(1);
    expect(saved[0].items.map((i) => i.arrangementId)).toEqual(["y"]);
  });

  it("stops when create fails and leaves following setlists untouched", async () => {
    const d = deps({ createSetlist: vi.fn().mockRejectedValue(new Error("down")) });
    const r = await migrateGuestSetlists([sl("a", ["x"]), sl("b", ["y"])], d);
    expect(r.partial).toEqual([]);
    expect(d.createSetlist).toHaveBeenCalledTimes(1);
    expect(d.addItem).not.toHaveBeenCalled();
    expect(d.save).not.toHaveBeenCalled();
  });

  it("saves after each setlist", async () => {
    const d = deps();
    await migrateGuestSetlists([sl("a", ["x"]), sl("b", ["y"])], d);
    expect(d.save).toHaveBeenCalledTimes(2);
    expect(d.save.mock.calls[0][0]).toHaveLength(1);
  });
});
