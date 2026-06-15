"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SetlistDetailViewScreen } from "@/components/setlist/setlist-detail-view";
import { useSession } from "@/hooks/use-session";
import { buildLocalSetlistDetail } from "@/lib/setlist-local";
import {
  cloudAddSetlistItem,
  cloudGetSetlist,
  cloudRemoveSetlistItem,
  cloudReorderSetlistItems,
  loadLocalSetlists,
  saveLocalSetlists,
} from "@/lib/storage";
import type { LocalSetlistStored, SetlistDetailView, StoredSong } from "@/lib/types";
import { useLibraryStore } from "@/store/use-library-store";

function useSetlistId() {
  const params = useParams();
  return (Array.isArray(params.id) ? params.id[0] : params.id) || "";
}

function localSetlistDetail(
  setId: string,
  folders: ReturnType<typeof useLibraryStore.getState>["folders"],
  recentes: ReturnType<typeof useLibraryStore.getState>["recentes"],
) {
  const found = (loadLocalSetlists() ?? []).find((setlist) => setlist.id === setId);
  return found ? buildLocalSetlistDetail(found, folders, recentes) : null;
}

function reorderedItems(items: SetlistDetailView["items"], itemId: string, direction: -1 | 1) {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const idx = sorted.findIndex((item) => item.itemId === itemId);
  const dest = idx + direction;

  if (idx < 0 || dest < 0 || dest >= sorted.length) return null;

  const next = [...sorted];
  const temp = next[idx].position;
  next[idx].position = next[dest].position;
  next[dest].position = temp;

  return next;
}

function localItemsWithPositions(
  items: LocalSetlistStored["items"],
  patches: Array<{ itemId: string; position: number }>,
) {
  return items.map((item) => {
    const patch = patches.find((p) => p.itemId === item.itemId);
    return patch ? { ...item, position: patch.position } : item;
  });
}

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      Setlist não encontrada.
      <br />
      <button onClick={onBack} className="mt-4 text-primary">Voltar</button>
    </div>
  );
}

function LoadingState() {
  return <div className="p-8 text-center text-muted-foreground">Carregando setlist...</div>;
}

export default function SetlistPage() {
  const router = useRouter();
  const setId = useSetlistId();

  const folders = useLibraryStore((s) => s.folders);
  const recentes = useLibraryStore((s) => s.recentes);

  const { status } = useSession();
  const isCloud = status === "authenticated";

  const [detail, setDetail] = useState<SetlistDetailView | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSetlist = useCallback(async () => {
    try {
      setDetail(isCloud ? await cloudGetSetlist(setId) : localSetlistDetail(setId, folders, recentes));
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [folders, isCloud, recentes, setId]);

  useEffect(() => {
    if (status !== "loading") void loadSetlist();
  }, [loadSetlist, status]);

  const updateLocalSetlist = (
    updateItems: (items: LocalSetlistStored["items"]) => LocalSetlistStored["items"],
  ) => {
    const updated = (loadLocalSetlists() ?? []).map((setlist) => {
      if (setlist.id !== setId) return setlist;
      return { ...setlist, items: updateItems(setlist.items) };
    });

    saveLocalSetlists(updated);
    const found = updated.find((setlist) => setlist.id === setId);
    if (found) setDetail(buildLocalSetlistDetail(found, folders, recentes));
  };

  const onAddItem = async (arrangementId: string) => {
    if (!detail) return;

    if (isCloud) {
      setDetail(await cloudAddSetlistItem(setId, arrangementId, null));
      return;
    }

    updateLocalSetlist((items) => [
      ...items,
      { itemId: Date.now().toString(), arrangementId, position: items.length, notes: null },
    ]);
  };

  const onRemoveItem = async (itemId: string) => {
    if (!detail) return;

    if (isCloud) {
      setDetail(await cloudRemoveSetlistItem(setId, itemId));
      return;
    }

    updateLocalSetlist((items) => items.filter((item) => item.itemId !== itemId));
  };

  const onMoveItem = async (itemId: string, direction: -1 | 1) => {
    if (!detail) return;

    const next = reorderedItems(detail.items, itemId, direction);
    if (!next) return;

    const patches = next.map((item) => ({ itemId: item.itemId, position: item.position }));
    const orderedItemIds = next.map((item) => item.itemId);

    if (isCloud) {
      setDetail(await cloudReorderSetlistItems(setId, orderedItemIds));
      return;
    }

    updateLocalSetlist((items) => localItemsWithPositions(items, patches));
  };

  const onOpenSong = (song: StoredSong) => router.push(`/song/${song.artistSlug}/${song.slug}`);
  const onBack = () => router.push("/");

  if (loading) return <LoadingState />;
  if (!detail) return <NotFoundState onBack={onBack} />;

  return (
    <SetlistDetailViewScreen
      detail={detail}
      folders={folders}
      recentes={recentes}
      onBack={onBack}
      onOpenSong={onOpenSong}
      onAddItem={onAddItem}
      onRemoveItem={onRemoveItem}
      onMoveItem={onMoveItem}
      onShare={() => {}}
    />
  );
}
