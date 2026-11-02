"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Radio, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { useSetlistNavigation } from "@/hooks/use-setlist-navigation";
import { focusLyricLine, useLyricsFollow } from "@/hooks/use-lyrics-follow";
import { useStage } from "@/hooks/use-stage";
import { useIsSubscriber } from "@/hooks/use-subscription";
import { cn } from "@/lib/utils";
import { useSongViewContext } from "./song-context";

type Nav = NonNullable<ReturnType<typeof useSetlistNavigation>>;

/** Na última linha da letra, sem nova linha por este tempo, o palco passa para a próxima música. */
const AUTO_NEXT_MS = 8_000;

function lyricLineCount() {
  return document.querySelectorAll("[data-lyric]").length;
}

function exitStageUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("stage");
  return `${url.pathname}${url.search}`;
}

function StageShell({ children, live }: { children: ReactNode; live: boolean }) {
  return (
    <div className="no-print fixed inset-x-0 bottom-[52px] z-40 flex items-center justify-between gap-2 border-t bg-background/95 px-3 py-1.5 text-sm backdrop-blur">
      <span className={cn("flex items-center gap-1.5 font-semibold", live ? "text-primary" : "text-muted-foreground")}>
        <Radio className={cn("size-4", live && "animate-pulse")} /> {live ? "Ao vivo" : "Palco"}
      </span>
      {children}
    </div>
  );
}

/** Dono: a IA ouve a voz, segue a letra, publica posição/linha/tom e passa para a próxima música no fim. */
function OwnerStage({ nav }: { nav: Nav }) {
  const router = useRouter();
  const { tone } = useSongViewContext();
  const { publish } = useStage(nav.setlistId, { poll: false });
  const [lineIndex, setLineIndex] = useState(-1);
  const { state, start, stop } = useLyricsFollow(setLineIndex);
  const following = state.status === "following";

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  useEffect(() => {
    publish({ position: nav.pos, lineIndex, transpose: tone, active: true });
  }, [publish, nav.pos, lineIndex, tone]);

  const goNext = useRef(() => nav.go(nav.next));
  useEffect(() => {
    goNext.current = () => nav.go(nav.next);
  });
  useEffect(() => {
    if (!nav.next || lineIndex < 0 || lineIndex < lyricLineCount() - 1) return;
    const id = setTimeout(() => goNext.current(), AUTO_NEXT_MS);
    return () => clearTimeout(id);
  }, [lineIndex, nav.next]);

  const end = () => {
    stop();
    publish({ position: nav.pos, lineIndex, transpose: tone, active: false });
    router.replace(exitStageUrl());
  };

  return (
    <StageShell live>
      <span className="min-w-0 truncate text-xs text-muted-foreground">
        {following ? "IA seguindo a letra" : "IA pausada"} · {nav.index}/{nav.total}
      </span>
      <div className="flex gap-1">
        <Button size="sm" variant={following ? "default" : "outline"} onClick={following ? stop : start} title="Ouvir a voz">
          <AudioLines className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={end}>
          <Square className="size-3.5" fill="currentColor" /> Encerrar
        </Button>
      </div>
    </StageShell>
  );
}

/** Músico: acompanha a música, o tom e a linha que o dono publica. */
function MemberStage({ nav }: { nav: Nav }) {
  const router = useRouter();
  const { tone, setTone } = useSongViewContext();
  const { data } = useStage(nav.setlistId, { poll: true });
  const stage = data?.stage;
  const ended = useRef(false);

  useEffect(() => {
    if (!stage) return;
    if (!stage.active) {
      if (ended.current) return;
      ended.current = true;
      toast("O palco foi encerrado.");
      router.replace(exitStageUrl());
      return;
    }
    if (stage.position !== nav.pos) {
      nav.goTo(stage.position);
      return;
    }
    if (stage.transpose !== tone) setTone(stage.transpose);
    if (stage.lineIndex >= 0) focusLyricLine(stage.lineIndex);
    // nav muda a cada render; position/linha/tom são o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.active, stage?.position, stage?.lineIndex, stage?.transpose, nav.pos]);

  const live = Boolean(stage?.active);
  return (
    <StageShell live={live}>
      <span className="min-w-0 truncate text-xs text-muted-foreground">
        {live ? `Seguindo ${data?.ownerName ?? "o dono do setlist"}` : "Aguardando o dono iniciar o palco"}
      </span>
    </StageShell>
  );
}

export function StageBar({ nav }: { nav: Nav }) {
  const isSubscriber = useIsSubscriber();
  const { data } = useStage(nav.setlistId, { poll: false });
  if (!data) return null;
  if (data.viewerRole === "member") return <MemberStage nav={nav} />;
  if (!isSubscriber) {
    return (
      <StageShell live={false}>
        <span className="text-xs text-muted-foreground">O modo palco é exclusivo para assinantes.</span>
      </StageShell>
    );
  }
  return <OwnerStage nav={nav} />;
}
