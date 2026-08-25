"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { arrangementKey } from "@/lib/arrangement-key";
import { SetlistDetailViewScreen } from "@/components/setlist/setlist-detail-view";
import { useSession } from "@/hooks/use-session";
import { buildLocalSetlistDetail } from "@/lib/setlist-local";
import {
  cloudAddSetlistItem,
  cloudCreateSetlistShareLink,
  cloudGetSetlist,
  cloudLeaveSetlist,
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
  const [moved] = next.splice(idx, 1);
  next.splice(dest, 0, moved);

  return next.map((item, position) => ({ ...item, position }));
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

async function resolveSetlistDetail(
  isCloud: boolean,
  setId: string,
  folders: ReturnType<typeof useLibraryStore.getState>["folders"],
  recentes: ReturnType<typeof useLibraryStore.getState>["recentes"],
) {
  return isCloud
    ? cloudGetSetlist(setId)
    : localSetlistDetail(setId, folders, recentes);
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
  const [shareBusy, setShareBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;
    void resolveSetlistDetail(isCloud, setId, folders, recentes)
      .then((nextDetail) => {
        if (!cancelled) setDetail(nextDetail);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [folders, isCloud, recentes, setId, status]);

  const updateLocalSetlist = (
    updateItems: (items: LocalSetlistStored["items"]) => LocalSetlistStored["items"],
  ) => {
    const updated = (loadLocalSetlists() ?? []).map((setlist) => {
      if (setlist.id !== setId) return setlist;
      return { ...setlist, items: updateItems(setlist.items), updatedAt: new Date().toISOString() };
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

    updateLocalSetlist((items) => {
      if (items.some((item) => item.arrangementId === arrangementId)) return items;

      return [
        ...items,
        {
          itemId:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          arrangementId,
          position: Math.max(-1, ...items.map((i) => i.position ?? 0)) + 1,
          notes: null,
        },
      ];
    });
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

  const onShare = async () => {
    if (shareBusy) return;

    setShareBusy(true);
    setShareError(null);
    try {
      const { token } = await cloudCreateSetlistShareLink(setId);
      setShareUrl(`${window.location.origin}/s/${token}`);
    } catch (err) {
      setShareError(err instanceof Error && err.message ? err.message : "Não foi possível gerar o link.");
    } finally {
      setShareBusy(false);
    }
  };

  const onDismissShare = () => {
    setShareUrl(null);
    setShareError(null);
  };

  const onOpenSong = (song: StoredSong) => {
    const params = new URLSearchParams({ arrangementId: arrangementKey(song) });
    if (detail?.viewerRole === "member" && detail.ownerId) params.set("ownerId", detail.ownerId);
    router.push(`/song/${song.artistSlug}/${song.slug}?${params.toString()}`);
  };
  const onBack = () => router.push("/");

  const onLeave = async () => {
    if (!isCloud) return;
    await cloudLeaveSetlist(setId);
    useLibraryStore.getState().setSharedSummary({
      folders: useLibraryStore.getState().sharedFolders,
      setlists: useLibraryStore.getState().sharedSetlists.filter((s) => s.id !== setId),
    });
    router.push("/");
  };

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
      onShare={isCloud && detail.viewerRole !== "member" ? onShare : undefined}
      onLeave={isCloud && detail.viewerRole === "member" ? onLeave : undefined}
      shareBusy={shareBusy}
      shareUrl={shareUrl}
      shareError={shareError}
      onDismissShare={onDismissShare}
      disabled={detail.viewerRole === "member"}
    />
  );
}
