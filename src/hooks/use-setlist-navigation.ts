"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { buildLocalSetlistDetail } from "@/lib/setlist-local";
import { neighbors, songHref } from "@/lib/setlist-navigation";
import { cloudGetSetlist, loadLocalSetlists } from "@/lib/storage";
import type { SetlistDetailView, SetlistItemView } from "@/lib/types";
import { useLibraryStore } from "@/store/use-library-store";

export function useSetlistNavigation() {
  const router = useRouter();
  const params = useSearchParams();
  const setlistId = params.get("setlist");
  const posParam = params.get("pos");
  const ownerId = params.get("ownerId");
  const pos = posParam === null ? NaN : Number(posParam);
  const active = Boolean(setlistId) && Number.isFinite(pos);

  const { status } = useSession();
  const folders = useLibraryStore((s) => s.folders);
  const recentes = useLibraryStore((s) => s.recentes);
  const [fetched, setFetched] = useState<SetlistDetailView | null>(null);

  const isCloud = status === "authenticated";
  useEffect(() => {
    if (!active || !setlistId || !isCloud) return;
    let cancelled = false;
    cloudGetSetlist(setlistId)
      .then((d) => {
        if (!cancelled) setFetched(d);
      })
      .catch(() => {
        if (!cancelled) setFetched(null);
      });
    return () => {
      cancelled = true;
    };
  }, [active, setlistId, isCloud]);

  let detail: SetlistDetailView | null = null;
  if (active && setlistId && status !== "loading") {
    if (isCloud) detail = fetched;
    else {
      const found = (loadLocalSetlists() ?? []).find((s) => s.id === setlistId);
      detail = found ? buildLocalSetlistDetail(found, folders, recentes) : null;
    }
  }

  if (!active || !detail || !setlistId) return null;

  const { prev, next } = neighbors(detail.items, pos);
  const playable = detail.items.filter((i) => i.song !== null);
  const index = playable.filter((i) => i.position <= pos).length;
  const go = (item: SetlistItemView | null) => {
    if (!item?.song) return;
    router.push(songHref(item.song, { setlistId, position: item.position, ownerId }));
  };

  return { prev, next, go, title: detail.title, index, total: playable.length };
}
