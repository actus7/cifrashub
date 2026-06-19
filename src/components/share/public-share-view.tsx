"use client";

import { Music, Rows3 } from "lucide-react";
import { SongContent } from "@/components/song/song-content";
import type { ShareSnapshotPayload } from "@/lib/share-payload";

type Props = {
  payload: ShareSnapshotPayload | null;
};

export function PublicShareView({ payload }: Props) {
  if (!payload) return <InvalidShare />;
  return payload.type === "arrangement" ? (
    <ArrangementShare payload={payload} />
  ) : (
    <SetlistShare payload={payload} />
  );
}

function InvalidShare() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-destructive">Link inválido ou expirado.</p>
    </div>
  );
}

function ArrangementShare({ payload }: { payload: Extract<ShareSnapshotPayload, { type: "arrangement" }> }) {
  const song = payload.song;
  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <header className="mx-auto mb-10 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">{song.title}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{song.artist}</p>
        <ReadOnlyNotice />
      </header>
      <div className="mx-auto max-w-3xl">
        <SharedSongContent song={song} />
      </div>
    </div>
  );
}

function SetlistShare({ payload }: { payload: Extract<ShareSnapshotPayload, { type: "setlist" }> }) {
  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <SetlistShareHeader payload={payload} />
      <ol className="mx-auto flex max-w-3xl list-decimal flex-col gap-8 pl-5">
        {[...payload.items].sort((a, b) => a.position - b.position).map((item) => (
          <SharedSetlistItem key={`${item.arrangementId}-${item.position}`} item={item} />
        ))}
      </ol>
    </div>
  );
}

function ReadOnlyNotice() {
  return <p className="mt-4 text-xs text-muted-foreground">Conteúdo compartilhado (somente leitura).</p>;
}

function SetlistShareHeader({ payload }: { payload: Extract<ShareSnapshotPayload, { type: "setlist" }> }) {
  return (
    <header className="mx-auto mb-8 max-w-3xl">
      <div className="mb-3 flex items-center gap-2 text-primary">
        <Rows3 className="size-6" />
        <span className="text-xs font-semibold tracking-wide uppercase">Setlist</span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{payload.title}</h1>
      {payload.description ? <p className="mt-2 text-muted-foreground">{payload.description}</p> : null}
      <ReadOnlyNotice />
    </header>
  );
}

function SharedSetlistItem({ item }: { item: Extract<ShareSnapshotPayload, { type: "setlist" }>["items"][number] }) {
  return (
    <li className="pl-2">
      {item.song ? <AvailableSetlistSong item={item} /> : <p className="text-muted-foreground">Música indisponível no snapshot.</p>}
    </li>
  );
}

function AvailableSetlistSong({ item }: { item: Extract<ShareSnapshotPayload, { type: "setlist" }>["items"][number] }) {
  if (!item.song) return null;
  return (
    <>
      <div className="mb-4 flex items-start gap-2">
        <Music className="mt-1 size-4 shrink-0 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">{item.song.title}</h2>
          <p className="text-sm text-muted-foreground">{item.song.artist}</p>
          {item.notes ? <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p> : null}
        </div>
      </div>
      <SharedSongContent song={item.song} />
    </>
  );
}

function SharedSongContent({ song }: { song: Extract<ShareSnapshotPayload, { type: "arrangement" }>["song"] }) {
  return (
    <SongContent
      songData={song.songData}
      showTabs
      simplified={false}
      nashvilleNumbers={song.nashvilleNumbers ?? false}
      nashvilleKey={song.cifraWrittenKey ?? song.cifraSoundingKey}
      effectiveTransposition={song.tone ?? 0}
      fontSizeOffset={0}
      columns={1}
      spacingOffset={0}
      onChordClick={() => {}}
    />
  );
}
