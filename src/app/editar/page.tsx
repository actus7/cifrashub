"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SongTextPreviewEditor } from "@/components/song/song-text-preview-editor";
import {
  readEditSnapshot,
  writeEditResult,
  type CifrasEditSnapshot,
} from "@/lib/cifras-edit-bridge";

function songUrl(origin: CifrasEditSnapshot["origin"]) {
  const params = new URLSearchParams();
  if (origin.folderId) params.set("folderId", origin.folderId);
  if (origin.arrangementId) params.set("arrangementId", origin.arrangementId);
  const query = params.toString();
  return `/song/${origin.artistSlug}/${origin.slug}${query ? `?${query}` : ""}`;
}

export default function EditarCifraPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CifrasEditSnapshot | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const s = readEditSnapshot();
    if (!s) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnapshot(null);
      router.replace("/");
      return;
    }

    setSnapshot(s);
  }, [router]);

  // undefined = ainda verificando localStorage; loading.tsx (Suspense boundary) cobre este estado.
  // null = snapshot não encontrado; redirect já disparado acima.
  if (snapshot === undefined || snapshot === null) {
    return null;
  }

  const { currentSong, songData, origin } = snapshot;
  const backToSong = () => router.push(songUrl(origin));

  return (
    <div className="flex min-h-screen flex-col bg-background print:hidden">
      <SongTextPreviewEditor
        wrapStickyChrome={(editorChrome, actionButtons) => (
          <div className="sticky top-0 z-30 shrink-0 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <header className="flex shrink-0 items-center gap-3 border-b border-border/40 px-4 py-3 sm:px-6">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl"
                onClick={backToSong}
                aria-label="Voltar sem salvar"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  Editar cifra
                </h1>
                <p className="truncate text-sm text-muted-foreground">
                  {currentSong.title} · {currentSong.artist}
                </p>
              </div>
              {actionButtons}
            </header>
            {editorChrome}
          </div>
        )}
        songData={songData}
        baseFontSizeOffsetPx={snapshot.display.fontSizeOffset}
        previewDisplay={{
          tone: snapshot.display.tone,
          capo: snapshot.display.capo,
          simplified: snapshot.display.simplified,
          // Coluna única na edição: prévia mais legível; prefs no snapshot seguem intactas ao voltar.
          columns: 1,
          spacingOffset: snapshot.display.spacingOffset,
        }}
        onCancel={backToSong}
        onApply={(next) => {
          writeEditResult(origin, next);
          backToSong();
        }}
      />
    </div>
  );
}
