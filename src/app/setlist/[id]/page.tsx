"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SetlistDetailViewScreen } from "@/components/setlist/setlist-detail-view";
import { useLibraryStore } from "@/store/use-library-store";
import {
  cloudAddSetlistItem,
  cloudGetSetlist,
  cloudRemoveSetlistItem,
  cloudReorderSetlistItems,
  saveLocalSetlists,
  loadLocalSetlists,
} from "@/lib/storage";
import { buildLocalSetlistDetail } from "@/lib/setlist-local";
import { useSession } from "@/hooks/use-session";
import type { LocalSetlistStored, SetlistDetailView, StoredSong } from "@/lib/types";

export default function SetlistPage() {
  const params = useParams();
  const router = useRouter();
  const setId = (Array.isArray(params.id) ? params.id[0] : params.id) || "";

  const folders = useLibraryStore((s) => s.folders);
  const recentes = useLibraryStore((s) => s.recentes);

  const { status } = useSession();
  const isCloud = status === "authenticated";

  const [detail, setDetail] = useState<SetlistDetailView | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSetlist = useCallback(async () => {
    try {
      if (isCloud) {
        const d = await cloudGetSetlist(setId);
        setDetail(d);
      } else {
        const local = loadLocalSetlists() ?? [];
        const found = local.find(x => x.id === setId);
        if (found) {
            setDetail(buildLocalSetlistDetail(found, folders, recentes));
        } else {
            setDetail(null);
        }
      }
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [folders, isCloud, recentes, setId]);

  useEffect(() => {
    if (status === "loading") return;
    loadSetlist();
  }, [loadSetlist, status]);

  const updateLocalSetlist = (
    updateItems: (items: LocalSetlistStored["items"]) => LocalSetlistStored["items"],
  ) => {
    const all = loadLocalSetlists() ?? [];
    const updated = all.map(s => {
      if (s.id !== setId) return s;
      return { ...s, items: updateItems(s.items) };
    });
    saveLocalSetlists(updated);
    const found = updated.find(x => x.id === setId);
    if (found) setDetail(buildLocalSetlistDetail(found, folders, recentes));
  };

  const onAddItem = async (arrangementId: string) => {
    if (!detail) return;
    if (isCloud) {
      const d = await cloudAddSetlistItem(setId, arrangementId, null);
      setDetail(d);
    } else {
      updateLocalSetlist((items) => [
        ...items,
        { itemId: Date.now().toString(), arrangementId, position: items.length, notes: null },
      ]);
    }
  };

  const onRemoveItem = async (itemId: string) => {
    if (!detail) return;
    if (isCloud) {
       const d = await cloudRemoveSetlistItem(setId, itemId);
       setDetail(d);
    } else {
       updateLocalSetlist((items) => items.filter(i => i.itemId !== itemId));
    }
  };

  const onMoveItem = async (itemId: string, direction: -1 | 1) => {
    if (!detail) return;
    const items = [...detail.items].sort((a,b) => a.position - b.position);
    const idx = items.findIndex(i => i.itemId === itemId);
    if (idx < 0) return;
    const dest = idx + direction;
    if (dest < 0 || dest >= items.length) return;

    // swapping positions
    const newItems = [...items];
    const temp = newItems[idx].position;
    newItems[idx].position = newItems[dest].position;
    newItems[dest].position = temp;

    const patches = newItems.map(i => ({ itemId: i.itemId, position: i.position }));
    const orderedItemIds = newItems.map(i => i.itemId);

    if (isCloud) {
       const d = await cloudReorderSetlistItems(setId, orderedItemIds);
       setDetail(d);
    } else {
        updateLocalSetlist((items) => items.map(it => {
          const p = patches.find(p => p.itemId === it.itemId);
          return p ? { ...it, position: p.position } : it;
        }));
    }
  };

  const onOpenSong = (song: StoredSong) => {
      router.push(`/song/${song.artistSlug}/${song.slug}`);
  };

  if (loading) {
     return <div className="p-8 text-center text-muted-foreground">Carregando setlist...</div>;
  }

  if (!detail) {
     return (
        <div className="p-8 text-center text-muted-foreground">
           Setlist não encontrada.
           <br/>
           <button onClick={() => router.push("/")} className="mt-4 text-primary">Voltar</button>
        </div>
     );
  }

  return (
    <SetlistDetailViewScreen
      detail={detail}
      folders={folders}
      recentes={recentes}
      onBack={() => router.push("/")}
      onOpenSong={onOpenSong}
      onAddItem={onAddItem}
      onRemoveItem={onRemoveItem}
      onMoveItem={onMoveItem}
      onShare={() => {}}
    />
  );
}
