"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExperimentalBadge } from "@/components/ui/experimental";
import type { FollowDiagnostics } from "@/hooks/use-song-follow";
import { cn } from "@/lib/utils";

const ENGINE_LABEL: Record<FollowDiagnostics["engine"], string> = {
  whisper: "Whisper",
  browser: "navegador",
  none: "sem voz",
};

function Meter({ value }: { value: number }) {
  return (
    <span className="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-muted align-middle">
      <span className="block h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  );
}

/** Painel ao vivo do "Seguir a música": o que cada fonte está dizendo e o que a fusão decidiu. */
export function FollowDiagnosticsPanel({ diag, onDownload }: { diag: FollowDiagnostics; onDownload: () => void }) {
  const agree = diag.wordsLine >= 0 && diag.wordsLine === diag.line;
  return (
    <div className="no-print fixed bottom-20 left-3 z-40 w-[min(19rem,calc(100vw-1.5rem))] rounded-xl border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-semibold">
          Seguir a música
          <ExperimentalBadge />
          {diag.locating && <span className="ml-1.5 animate-pulse font-normal text-muted-foreground">localizando…</span>}
          {!diag.locating && diag.lost && <span className="ml-1.5 animate-pulse font-normal text-amber-500">recalculando rota…</span>}
        </span>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={onDownload}>
          <Download className="size-3.5" /> Diagnóstico
        </Button>
      </div>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1">
        <dt className="text-muted-foreground">Acorde ouvido</dt>
        <dd>
          <b className="mr-1.5">{diag.chord || "—"}</b>
          <Meter value={diag.chordSimilarity} />
        </dd>
        <dt className="text-muted-foreground">Voz ({ENGINE_LABEL[diag.engine]})</dt>
        <dd className="truncate" title={diag.words}>
          {diag.words || "—"}
        </dd>
        <dt className="text-muted-foreground">Linha</dt>
        <dd>
          <b className="mr-1.5">{diag.line >= 0 ? diag.line + 1 : "—"}</b>
          <Meter value={diag.probability} />
          {diag.modelLine >= 0 && diag.modelLine !== diag.line && (
            <span className="ml-1.5 text-muted-foreground" title="O modelo está considerando outra linha; a tela só muda se ela se firmar.">
              (avaliando {diag.modelLine + 1})
            </span>
          )}
          <span className={cn("ml-1.5", agree ? "text-primary" : "text-muted-foreground")}>
            {diag.wordsLine >= 0 ? (agree ? "voz confirma" : `voz: ${diag.wordsLine + 1}`) : ""}
          </span>
        </dd>
        <dt className="text-muted-foreground">Andamento</dt>
        <dd>{diag.secondsPerChord.toFixed(1)} s por acorde</dd>
      </dl>
      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        Pode errar. Rolar a tela com a mão pausa o acompanhamento por alguns segundos.
      </p>
    </div>
  );
}
