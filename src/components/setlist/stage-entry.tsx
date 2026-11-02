"use client";

import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExperimentalBadge, notifyExperimentalOnce } from "@/components/ui/experimental";
import { useStage } from "@/hooks/use-stage";
import { useIsSubscriber } from "@/hooks/use-subscription";
import { songHref } from "@/lib/setlist-navigation";
import type { SetlistDetailView } from "@/lib/types";

type Props = { detail: SetlistDetailView };

function playableItems(detail: SetlistDetailView) {
  return [...detail.items].filter((i) => i.song !== null).sort((a, b) => a.position - b.position);
}

/** Na página do setlist: o dono assinante inicia o palco; os membros entram quando ele está ao vivo. */
export function StageEntry({ detail }: Props) {
  const router = useRouter();
  const isSubscriber = useIsSubscriber();
  const isMember = detail.viewerRole === "member";
  const { data } = useStage(detail.id, { poll: isMember });
  const items = playableItems(detail);
  const live = data?.stage?.active ? data.stage : null;
  const ownerId = isMember ? detail.ownerId : null;

  const open = (position: number) => {
    const item = items.find((i) => i.position === position) ?? items[0];
    if (item?.song) router.push(songHref(item.song, { setlistId: detail.id, position: item.position, ownerId, stage: true }));
  };

  if (items.length === 0) return null;

  if (isMember) {
    if (!live) return null;
    return (
      <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Radio className="size-4 animate-pulse" /> {detail.ownerName ?? "O dono"} está ao vivo
        </span>
        <Button size="sm" onClick={() => open(live.position)}>
          Entrar no palco
        </Button>
      </div>
    );
  }

  if (!isSubscriber) return null;

  const start = async () => {
    notifyExperimentalOnce(
      "stage",
      "O Modo palco é experimental: a IA pode errar a linha, o tom ou a troca de música. Os botões e os comandos de voz continuam com você.",
    );
    const first = live?.position ?? items[0].position;
    const res = await fetch(`/api/setlists/${encodeURIComponent(detail.id)}/stage`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: first, lineIndex: -1, transpose: 0, active: true }),
    }).catch(() => null);
    if (!res?.ok) {
      toast.error("Não foi possível iniciar o palco. Tente de novo.");
      return;
    }
    open(first);
  };

  return (
    <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2">
      <span className="text-sm text-muted-foreground">
        <span className="mr-1.5 font-medium text-foreground">Modo palco</span>
        <ExperimentalBadge className="mr-1.5 align-middle" />
        a IA segue a música e os músicos acompanham na tela deles. Pode errar: você continua no controle.
      </span>
      <Button size="sm" className="shrink-0 gap-1.5" onClick={() => void start()}>
        <Radio className="size-4" /> {live ? "Voltar ao palco" : "Iniciar palco"}
      </Button>
    </div>
  );
}
