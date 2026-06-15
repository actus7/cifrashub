"use client";

import type { ReactNode } from "react";
import {
  Bookmark,
  ChevronLeft,
  FastForward,
  FileEdit,
  Link2,
  ListMusic,
  Maximize,
  Minus,
  MonitorPlay,
  Pause,
  Play,
  Plus,
  Printer,
  Rewind,
  Timer,
} from "lucide-react";
import { AuthHeaderControl } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { transposeRootNote } from "@/lib/music";
import { cn } from "@/lib/utils";
import type { CurrentSongMeta } from "@/lib/types";
import { useSongViewContext } from "./song-context";

export function CifraClubMeta({
  song,
  tone = 0,
  capo = 0,
  className,
}: {
  song: CurrentSongMeta;
  tone?: number;
  capo?: number;
  className?: string;
}) {
  const lines = cifraClubMetaLines(song, tone, capo);
  if (lines.length === 0) return null;

  return (
    <div
      className={cn(
        "space-y-0.5 text-left text-[10px] leading-snug text-muted-foreground",
        className,
      )}
    >
      {lines.map((line) => (
        <p key={line} className="text-balance">
          {line}
        </p>
      ))}
    </div>
  );
}

type SongHeaderProps = {
  extraActions?: ReactNode;
};

type IconActionButtonProps = {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function SongHeader({ extraActions }: SongHeaderProps) {
  const { zenMode } = useSongViewContext();
  if (zenMode) return null;

  return (
    <header className="no-print sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex items-center justify-between px-3 py-3 sm:px-4">
        <SongHeaderTitle />
        <SongHeaderActions extraActions={extraActions} />
      </div>
    </header>
  );
}

function cifraClubMetaLines(song: CurrentSongMeta, tone: number, capo: number) {
  const lines = [originalKeyLine(song), currentKeyLine(song, tone, capo), capoLine(capo)].filter(
    (line): line is string => Boolean(line),
  );
  return shouldShowCifraMeta(song, tone, capo) ? lines : [];
}

function shouldShowCifraMeta(song: CurrentSongMeta, tone: number, capo: number) {
  return hasStaticCifraMeta(song) || capo !== 0 || tone !== 0;
}

function hasStaticCifraMeta(song: CurrentSongMeta) {
  return Boolean(song.cifraSoundingKey) || Boolean(song.cifraWrittenKey) || song.cifraCapo !== undefined;
}

function originalKeyLine(song: CurrentSongMeta) {
  const key = song.cifraWrittenKey ?? song.cifraSoundingKey;
  return key ? `Tom original: ${key}` : null;
}

function currentKeyLine(song: CurrentSongMeta, tone: number, capo: number) {
  if (song.cifraWrittenKey) return writtenKeyLine(song.cifraWrittenKey, tone, capo);
  if (song.cifraSoundingKey) return `Tom: ${transposeRootNote(song.cifraSoundingKey, tone)}`;
  return null;
}

function writtenKeyLine(key: string, tone: number, capo: number) {
  const forma = transposeRootNote(key, tone);
  const soando = transposeRootNote(key, tone + capo);
  return forma === soando ? `Tom: ${forma}` : `Tom: ${soando} (forma dos acordes em ${forma})`;
}

function capoLine(capo: number) {
  return capo > 0 ? `Capotraste na ${capo}ª casa` : null;
}

function SongHeaderTitle() {
  const { currentSong, onBack, onOpenArtistSongs, tone, capo } = useSongViewContext();

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-ml-1 shrink-0 rounded-xl text-muted-foreground"
        onClick={onBack}
        aria-label="Voltar"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <MobileSongTitle song={currentSong} />
      <DesktopSongTitle
        song={currentSong}
        tone={tone}
        capo={capo}
        onOpenArtistSongs={onOpenArtistSongs}
      />
    </div>
  );
}

function MobileSongTitle({ song }: { song: CurrentSongMeta }) {
  return (
    <div className="min-w-0 flex-1 sm:hidden">
      <p className="truncate text-sm font-semibold leading-tight text-foreground">{song.title}</p>
      <p className="truncate text-[11px] text-muted-foreground">{song.artist}</p>
    </div>
  );
}

function DesktopSongTitle({
  song,
  tone,
  capo,
  onOpenArtistSongs,
}: {
  song: CurrentSongMeta;
  tone: number;
  capo: number;
  onOpenArtistSongs: () => void;
}) {
  return (
    <div className="hidden min-w-0 flex-1 items-start gap-3 sm:flex md:gap-5">
      <div className="min-w-0 w-fit max-w-[min(32rem,calc(100%-9rem))]">
        <h1 className="truncate text-sm leading-tight font-semibold text-foreground">{song.title}</h1>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <h2 className="min-w-0 truncate text-[11px] text-muted-foreground">{song.artist}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 rounded-md px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={onOpenArtistSongs}
            title="Ver todas as músicas do artista"
          >
            <ListMusic className="mr-1 size-3" />
            Músicas
          </Button>
        </div>
      </div>
      <CifraClubMeta
        song={song}
        tone={tone}
        capo={capo}
        className="shrink-0 text-balance sm:max-w-[min(240px,36vw)] sm:pt-0.5"
      />
    </div>
  );
}

function SongHeaderActions({ extraActions }: SongHeaderProps) {
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <AutoScrollHeaderControl />
      <MetronomeHeaderControl />
      <div className="mx-0.5 hidden h-5 w-px bg-border/50 sm:block" />
      <StaticHeaderActions />
      {extraActions}
      <SaveHeaderAction />
      <AuthHeaderControl className="ml-0.5 sm:ml-1" />
    </div>
  );
}

function AutoScrollHeaderControl() {
  const { autoScroll, setAutoScroll, scrollSpeed, setScrollSpeed } = useSongViewContext();

  return (
    <div className="flex items-center">
      <HeaderToggleButton
        active={autoScroll}
        inactiveLabel="Rolagem automática"
        activeLabel="Parar rolagem"
        onClick={() => setAutoScroll(!autoScroll)}
      >
        {autoScroll ? (
          <Pause className="size-[18px]" fill="currentColor" />
        ) : (
          <Play className="ml-0.5 size-[18px]" fill="currentColor" />
        )}
      </HeaderToggleButton>
      {autoScroll && <AutoScrollSpeedControls scrollSpeed={scrollSpeed} setScrollSpeed={setScrollSpeed} />}
    </div>
  );
}

function MetronomeHeaderControl() {
  const { metronomeActive, setMetronomeActive, bpm, setBpm } = useSongViewContext();

  return (
    <div className="flex items-center">
      <HeaderToggleButton
        active={metronomeActive}
        inactiveLabel="Metrônomo"
        activeLabel="Parar metrônomo"
        onClick={() => setMetronomeActive(!metronomeActive)}
      >
        {metronomeActive ? <span className="text-[11px] font-bold">{bpm}</span> : <Timer className="size-[18px]" />}
      </HeaderToggleButton>
      {metronomeActive && <MetronomeBpmControls bpm={bpm} setBpm={setBpm} />}
    </div>
  );
}

function HeaderToggleButton({
  active,
  inactiveLabel,
  activeLabel,
  onClick,
  children,
}: {
  active: boolean;
  inactiveLabel: string;
  activeLabel: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const label = active ? activeLabel : inactiveLabel;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "rounded-xl",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

function AutoScrollSpeedControls({
  scrollSpeed,
  setScrollSpeed,
}: {
  scrollSpeed: number;
  setScrollSpeed: (speed: number) => void;
}) {
  return (
    <div className="hidden items-center gap-0.5 sm:flex">
      <HeaderMiniButton onClick={() => setScrollSpeed(Math.max(1, scrollSpeed - 1))} disabled={scrollSpeed <= 1}>
        <Rewind className="size-3" />
      </HeaderMiniButton>
      <span className="min-w-[1.5rem] text-center text-[10px] font-bold text-primary">{scrollSpeed}x</span>
      <HeaderMiniButton onClick={() => setScrollSpeed(Math.min(5, scrollSpeed + 1))} disabled={scrollSpeed >= 5}>
        <FastForward className="size-3" />
      </HeaderMiniButton>
    </div>
  );
}

function MetronomeBpmControls({
  bpm,
  setBpm,
}: {
  bpm: number;
  setBpm: (bpm: number) => void;
}) {
  return (
    <div className="hidden items-center gap-0.5 sm:flex">
      <HeaderMiniButton onClick={() => setBpm(Math.max(40, bpm - 5))}>
        <Minus className="size-3" />
      </HeaderMiniButton>
      <HeaderMiniButton onClick={() => setBpm(Math.min(240, bpm + 5))}>
        <Plus className="size-3" />
      </HeaderMiniButton>
    </div>
  );
}

function HeaderMiniButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 rounded-lg text-muted-foreground"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function StaticHeaderActions() {
  const {
    onOpenVideo,
    onToggleZen,
    onPrint,
    onShareArrangement,
    shareArrangementDisabled,
    onOpenSongEditor,
    isParsing,
    parseError,
  } = useSongViewContext();

  return (
    <>
      <IconActionButton title="Abrir mini player no YouTube" onClick={onOpenVideo}>
        <MonitorPlay className="size-[18px]" />
      </IconActionButton>
      <IconActionButton title="Modo palco (Zen)" onClick={onToggleZen}>
        <Maximize className="size-[18px]" />
      </IconActionButton>
      <IconActionButton title="Imprimir / PDF" onClick={onPrint} className="hidden sm:flex">
        <Printer className="size-[18px]" />
      </IconActionButton>
      {onShareArrangement ? (
        <IconActionButton title="Copiar link de compartilhamento" onClick={onShareArrangement} disabled={shareArrangementDisabled}>
          <Link2 className="size-[18px]" />
        </IconActionButton>
      ) : null}
      {onOpenSongEditor ? (
        <IconActionButton title="Editar cifra" onClick={onOpenSongEditor} disabled={isParsing || Boolean(parseError)}>
          <FileEdit className="size-[18px]" />
        </IconActionButton>
      ) : null}
    </>
  );
}

function IconActionButton({ title, onClick, disabled, className, children }: IconActionButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-40", className)}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  );
}

function SaveHeaderAction() {
  const { isSavedInAnyFolder, setSaveModalOpen } = useSongViewContext();
  const title = isSavedInAnyFolder ? "Salvo em pasta" : "Salvar em pasta";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "rounded-xl",
        isSavedInAnyFolder ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
      )}
      onClick={() => setSaveModalOpen(true)}
      title={title}
      aria-label={title}
    >
      <Bookmark className="size-[18px]" fill={isSavedInAnyFolder ? "currentColor" : "none"} />
    </Button>
  );
}
