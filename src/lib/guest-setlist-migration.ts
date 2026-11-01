import type { LocalSetlistStored } from "@/lib/types";

type Item = LocalSetlistStored["items"][number];

export type GuestMigrationDeps = {
  createSetlist: (
    title: string,
    description: string | null,
  ) => Promise<{ setlist: { id: string } }>;
  addItem: (setlistId: string, arrangementId: string, notes: string | null) => Promise<unknown>;
  save: (next: LocalSetlistStored[]) => void;
};

export async function migrateGuestSetlists(
  guest: LocalSetlistStored[],
  deps: GuestMigrationDeps,
): Promise<{ partial: Array<{ title: string; failedCount: number }> }> {
  let remaining = [...guest];
  const partial: Array<{ title: string; failedCount: number }> = [];

  for (const sl of guest) {
    let setlistId: string;
    try {
      setlistId = (await deps.createSetlist(sl.title, sl.description ?? null)).setlist.id;
    } catch {
      break;
    }

    const failedItems: Item[] = [];
    for (const item of sl.items) {
      try {
        await deps.addItem(setlistId, item.arrangementId, item.notes ?? null);
      } catch {
        failedItems.push(item);
      }
    }

    if (failedItems.length === 0) {
      remaining = remaining.filter((x) => x.id !== sl.id);
    } else {
      remaining = remaining.map((x) => (x.id === sl.id ? { ...x, items: failedItems } : x));
      partial.push({ title: sl.title, failedCount: failedItems.length });
    }
    deps.save(remaining);
  }

  return { partial };
}
