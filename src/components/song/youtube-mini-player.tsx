"use client";

import type { ReactNode } from "react";
import { memo, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

type YoutubeMiniPlayerProps = {
  open: boolean;
  onClose: () => void;
  embedUrl: string | null;
  isParsing: boolean;
  parseError: string | null;
  fallbackSearchQuery: string;
  onVideoResolved?: (videoId: string) => void;
  songId: string;
};

type MiniPlayerBodyProps = {
  embedUrl: string | null;
  fallbackFailed: boolean;
  fallbackSearchQuery: string;
  isParsing: boolean;
  onRetry: () => void;
  parseError: string | null;
  showSearchSpinner: boolean;
};

type MiniPlayerPanelProps = MiniPlayerBodyProps & {
  onClose: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
  panelRef: React.RefObject<HTMLElement | null>;
  pos: { x: number; y: number } | null;
};

export const YoutubeMiniPlayer = memo(function YoutubeMiniPlayer({
  open,
  ...props
}: YoutubeMiniPlayerProps) {
  if (!open) return null;
  return <YoutubeMiniPlayerContent {...props} />;
});

function YoutubeMiniPlayerContent({
  onClose,
  embedUrl,
  isParsing,
  parseError,
  fallbackSearchQuery,
  onVideoResolved,
  songId,
}: Omit<YoutubeMiniPlayerProps, "open">) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useMiniPlayerDrag({
    dragOffsetRef,
    isDragging,
    panelRef,
    setIsDragging,
    setPos,
  });

  useYoutubeFallbackSearch({
    embedUrl,
    fallbackSearchQuery,
    isParsing,
    onVideoResolved,
    retryToken,
    setFallbackFailed,
    setFallbackLoading,
    songId,
  });

  const shouldSearch = Boolean(onVideoResolved) && !embedUrl && !isParsing;

  return (
    <MiniPlayerPanel
      embedUrl={embedUrl}
      fallbackFailed={fallbackFailed}
      fallbackSearchQuery={fallbackSearchQuery}
      isParsing={isParsing}
      onClose={onClose}
      onPointerDown={(event) => startMiniPlayerDrag(event, panelRef, dragOffsetRef, setPos, setIsDragging)}
      onRetry={() => setRetryToken((token) => token + 1)}
      panelRef={panelRef}
      parseError={parseError}
      pos={pos}
      showSearchSpinner={shouldSearch && (!fallbackFailed || fallbackLoading)}
    />
  );
}

function useMiniPlayerDrag({
  dragOffsetRef,
  isDragging,
  panelRef,
  setIsDragging,
  setPos,
}: {
  dragOffsetRef: React.RefObject<{ x: number; y: number }>;
  isDragging: boolean;
  panelRef: React.RefObject<HTMLElement | null>;
  setIsDragging: (dragging: boolean) => void;
  setPos: (pos: { x: number; y: number }) => void;
}) {
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (event: PointerEvent) => {
      const nextPos = nextDragPosition(event, panelRef.current, dragOffsetRef.current);
      if (nextPos) setPos(nextPos);
    };
    const onUp = () => setIsDragging(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragOffsetRef, isDragging, panelRef, setIsDragging, setPos]);
}

function useYoutubeFallbackSearch({
  embedUrl,
  fallbackSearchQuery,
  isParsing,
  onVideoResolved,
  retryToken,
  setFallbackFailed,
  setFallbackLoading,
  songId,
}: {
  embedUrl: string | null;
  fallbackSearchQuery: string;
  isParsing: boolean;
  onVideoResolved?: (videoId: string) => void;
  retryToken: number;
  setFallbackFailed: (failed: boolean) => void;
  setFallbackLoading: (loading: boolean) => void;
  songId: string;
}) {
  const onVideoResolvedRef = useRef(onVideoResolved);
  useEffect(() => {
    onVideoResolvedRef.current = onVideoResolved;
  }, [onVideoResolved]);

  useEffect(() => {
    if (embedUrl || isParsing || !onVideoResolvedRef.current) return;

    let cancelled = false;
    setFallbackLoading(true);
    setFallbackFailed(false);

    void resolveYoutubeFallback(fallbackSearchQuery)
      .then((videoId) => {
        if (cancelled) return;
        if (videoId) onVideoResolvedRef.current?.(videoId);
        else setFallbackFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFallbackFailed(true);
      })
      .finally(() => {
        if (!cancelled) setFallbackLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [embedUrl, isParsing, fallbackSearchQuery, songId, retryToken, setFallbackFailed, setFallbackLoading]);
}

async function resolveYoutubeFallback(query: string) {
  const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
  const data = (await res.json()) as { videoId?: string | null };
  const id = typeof data.videoId === "string" ? data.videoId.trim() : "";
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}

function startMiniPlayerDrag(
  event: React.PointerEvent,
  panelRef: React.RefObject<HTMLElement | null>,
  dragOffsetRef: React.RefObject<{ x: number; y: number }>,
  setPos: (pos: { x: number; y: number }) => void,
  setIsDragging: (dragging: boolean) => void,
) {
  const panel = panelRef.current;
  if (!panel) return;

  const rect = panel.getBoundingClientRect();
  dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  setPos({ x: rect.left, y: rect.top });
  setIsDragging(true);
}

function nextDragPosition(
  event: PointerEvent,
  panel: HTMLElement | null,
  offset: { x: number; y: number },
) {
  if (!panel) return null;

  const rect = panel.getBoundingClientRect();
  const maxX = Math.max(0, window.innerWidth - rect.width);
  const maxY = Math.max(0, window.innerHeight - rect.height);
  return {
    x: Math.min(maxX, Math.max(0, event.clientX - offset.x)),
    y: Math.min(maxY, Math.max(0, event.clientY - offset.y)),
  };
}

function MiniPlayerPanel({
  embedUrl,
  fallbackFailed,
  fallbackSearchQuery,
  isParsing,
  onClose,
  onPointerDown,
  onRetry,
  panelRef,
  parseError,
  pos,
  showSearchSpinner,
}: MiniPlayerPanelProps) {
  return (
    <section
      ref={panelRef}
      className="no-print fixed z-40 w-[min(82vw,300px)] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      style={pos ? { left: pos.x, top: pos.y } : { right: 12, bottom: 12 }}
    >
      <MiniPlayerHeader onClose={onClose} onPointerDown={onPointerDown} />
      <MiniPlayerBody
        embedUrl={embedUrl}
        fallbackFailed={fallbackFailed}
        fallbackSearchQuery={fallbackSearchQuery}
        isParsing={isParsing}
        onRetry={onRetry}
        parseError={parseError}
        showSearchSpinner={showSearchSpinner}
      />
    </section>
  );
}

function MiniPlayerHeader({
  onClose,
  onPointerDown,
}: {
  onClose: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  return (
    <div
      className="flex cursor-grab touch-none items-center justify-between border-b border-border px-2.5 py-1.5 active:cursor-grabbing"
      onPointerDown={onPointerDown}
    >
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">YouTube</p>
      <button
        type="button"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onClose}
        aria-label="Fechar mini player"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function MiniPlayerBody(props: MiniPlayerBodyProps) {
  return (
    <div className="aspect-video w-full bg-black">
      {miniPlayerBodyContent(props)}
    </div>
  );
}

function miniPlayerBodyContent({
  embedUrl,
  fallbackFailed,
  fallbackSearchQuery,
  isParsing,
  onRetry,
  parseError,
  showSearchSpinner,
}: MiniPlayerBodyProps) {
  if (isParsing) {
    return <LoadingMessage>Carregando vídeo junto com a cifra…</LoadingMessage>;
  }

  if (embedUrl) {
    return <YoutubeIframe embedUrl={embedUrl} />;
  }

  if (showSearchSpinner) {
    return <LoadingMessage>Buscando vídeo no YouTube…</LoadingMessage>;
  }

  return (
    <FallbackMessage
      fallbackFailed={fallbackFailed}
      fallbackSearchQuery={fallbackSearchQuery}
      onRetry={onRetry}
      parseError={parseError}
    />
  );
}

function YoutubeIframe({ embedUrl }: { embedUrl: string }) {
  return (
    <iframe
      className="h-full w-full"
      src={embedUrl}
      title="Mini player do YouTube"
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
}

function LoadingMessage({ children }: { children: ReactNode }) {
  return (
    <MiniPlayerMessage icon={<Loader2 className="size-7 animate-spin text-muted-foreground" />}>
      {children}
    </MiniPlayerMessage>
  );
}

function FallbackMessage({
  fallbackFailed,
  fallbackSearchQuery,
  onRetry,
  parseError,
}: {
  fallbackFailed: boolean;
  fallbackSearchQuery: string;
  onRetry: () => void;
  parseError: string | null;
}) {
  return (
    <MiniPlayerMessage>
      <p className="text-xs text-muted-foreground">
        {fallbackMessageText(parseError, fallbackFailed)}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {fallbackFailed && (
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            onClick={onRetry}
          >
            Tentar de novo
          </button>
        )}
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(fallbackSearchQuery)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Abrir busca no YouTube
        </a>
      </div>
    </MiniPlayerMessage>
  );
}

function fallbackMessageText(parseError: string | null, fallbackFailed: boolean) {
  if (parseError) {
    return "Não foi possível carregar a cifra. Você ainda pode buscar o áudio no YouTube.";
  }
  if (fallbackFailed) {
    return "Não achamos um vídeo automático para tocar aqui. Tente de novo ou abra a busca no YouTube.";
  }
  return "Não encontramos o vídeo associado a esta cifra no Cifra Club.";
}

function MiniPlayerMessage({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 px-3 text-center">
      {icon}
      {children}
    </div>
  );
}
