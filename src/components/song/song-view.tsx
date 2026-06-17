"use client";

import { CifraClubMeta, SongHeader } from "./song-header";
import { SongToolbar } from "./song-toolbar";
import { SaveModal } from "./save-modal";
import { ChordPopup } from "./chord-popup";
import { SongContent } from "./song-content";
import { ZenExitButton } from "./zen-exit-button";
import { YoutubeMiniPlayer } from "./youtube-mini-player";
import { SongLoadingState } from "./song-loading-state";
import { SongErrorState } from "./song-error-state";
import { ArtistLinkButton } from "./artist-link-button";
import { songViewMainClassName } from "@/lib/song-article-layout";
import { currentSongKey } from "@/lib/current-song-key";
import { useSongViewContext, type SongViewContextValue } from "./song-context";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { useMetronome } from "@/hooks/use-metronome";
import { useSongKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

type SongViewCtx = SongViewContextValue;

type SongTitleBlockProps = Pick<SongViewCtx, "currentSong" | "zenMode" | "onOpenArtistSongs" | "tone" | "capo">;
type SongBodyProps = Pick<SongViewCtx, "isParsing" | "parseError" | "songData" | "showTabs" | "simplified" | "effectiveTransposition" | "fontSizeOffset" | "columns" | "spacingOffset" | "setActiveChord">;
type SongOverlaysProps = Pick<SongViewCtx, "activeChord" | "setActiveChord" | "mirrored" | "capo" | "youtubeMiniOpen" | "setYoutubeMiniOpen" | "youtubeEmbedUrl" | "isParsing" | "parseError" | "youtubeFallbackSearchQuery" | "onYoutubeVideoResolved" | "currentSong">;
type SongSaveModalProps = Pick<SongViewCtx, "saveModalOpen" | "setSaveModalOpen" | "folders" | "currentSong" | "newFolderName" | "setNewFolderName" | "onCreateFolderFromSave" | "onToggleSongInFolder">;

function useSongViewSideEffects(ctx: SongViewCtx) {
  useAutoScroll(ctx.autoScroll, ctx.scrollSpeed);
  useMetronome(ctx.metronomeActive, ctx.bpm);
  useSongKeyboardShortcuts({
    enabled: !ctx.isParsing && !ctx.parseError,
    onToggleAutoScroll: () => ctx.setAutoScroll(!ctx.autoScroll),
    onToggleZen: ctx.onToggleZen,
    onScrollDown: () => window.scrollBy({ top: window.innerHeight / 2, behavior: "smooth" }),
    onScrollUp: () => window.scrollBy({ top: -window.innerHeight / 2, behavior: "smooth" }),
  });
}

function SongChrome({ zenMode, onToggleZen }: Pick<SongViewCtx, "zenMode" | "onToggleZen">) {
  return (
    <>
      <SongHeader />
      {zenMode && <ZenExitButton onExit={onToggleZen} />}
      <SongToolbar />
    </>
  );
}

function SongSaveModalHost({
  saveModalOpen,
  setSaveModalOpen,
  folders,
  currentSong,
  newFolderName,
  setNewFolderName,
  onCreateFolderFromSave,
  onToggleSongInFolder,
}: SongSaveModalProps) {
  return (
    <SaveModal
      open={saveModalOpen}
      onOpenChange={setSaveModalOpen}
      folders={folders}
      currentSong={currentSong}
      newFolderName={newFolderName}
      onNewFolderNameChange={setNewFolderName}
      onCreateFolder={onCreateFolderFromSave}
      onToggleSongInFolder={onToggleSongInFolder}
    />
  );
}

function SongTitleBlock({ currentSong, zenMode, onOpenArtistSongs, tone, capo }: SongTitleBlockProps) {
  return (
    <div className={zenMode ? "no-print mb-10 mt-6" : "no-print mb-10 mt-2 sm:hidden"}>
      <h1 className="mb-1.5 text-3xl font-bold tracking-tight text-foreground md:text-5xl">
        {currentSong.title}
      </h1>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <h2 className="min-w-0 text-lg font-medium text-muted-foreground md:text-xl">
          {currentSong.artist}
        </h2>
        <ArtistLinkButton onClick={onOpenArtistSongs} variant="inline" />
      </div>
      <CifraClubMeta song={currentSong} tone={tone} capo={capo} className="mt-2" />
    </div>
  );
}

function SongBody({
  isParsing,
  parseError,
  songData,
  showTabs,
  simplified,
  effectiveTransposition,
  fontSizeOffset,
  columns,
  spacingOffset,
  setActiveChord,
}: SongBodyProps) {
  if (isParsing) return <SongLoadingState />;
  if (parseError) return <SongErrorState error={parseError} />;

  return (
    <SongContent
      songData={songData}
      showTabs={showTabs}
      simplified={simplified}
      effectiveTransposition={effectiveTransposition}
      fontSizeOffset={fontSizeOffset}
      columns={columns}
      spacingOffset={spacingOffset}
      onChordClick={setActiveChord}
    />
  );
}

function SongMain(ctx: SongViewCtx) {
  return (
    <main
      className={songViewMainClassName()}
      onClick={ctx.onTapZone}
      aria-label={`Cifra de ${ctx.currentSong.title}`}
    >
      <SongTitleBlock
        currentSong={ctx.currentSong}
        zenMode={ctx.zenMode}
        onOpenArtistSongs={ctx.onOpenArtistSongs}
        tone={ctx.tone}
        capo={ctx.capo}
      />
      <SongBody
        isParsing={ctx.isParsing}
        parseError={ctx.parseError}
        songData={ctx.songData}
        showTabs={ctx.showTabs}
        simplified={ctx.simplified}
        effectiveTransposition={ctx.effectiveTransposition}
        fontSizeOffset={ctx.fontSizeOffset}
        columns={ctx.columns}
        spacingOffset={ctx.spacingOffset}
        setActiveChord={ctx.setActiveChord}
      />
    </main>
  );
}

function SongOverlays({
  activeChord,
  setActiveChord,
  mirrored,
  capo,
  youtubeMiniOpen,
  setYoutubeMiniOpen,
  youtubeEmbedUrl,
  isParsing,
  parseError,
  youtubeFallbackSearchQuery,
  onYoutubeVideoResolved,
  currentSong,
}: SongOverlaysProps) {
  return (
    <>
      <ChordPopup
        chord={activeChord}
        onClose={() => setActiveChord(null)}
        mirrored={mirrored}
        capo={capo}
      />
      <YoutubeMiniPlayer
        open={youtubeMiniOpen}
        onClose={() => setYoutubeMiniOpen(false)}
        embedUrl={youtubeEmbedUrl}
        isParsing={isParsing}
        parseError={parseError}
        fallbackSearchQuery={youtubeFallbackSearchQuery}
        onVideoResolved={onYoutubeVideoResolved}
        songId={currentSongKey(currentSong)}
      />
    </>
  );
}

export function SongView() {
  const ctx = useSongViewContext();
  useSongViewSideEffects(ctx);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-20 sm:pb-16 selection:bg-primary/30 print:bg-white print:text-black">
      <SongChrome zenMode={ctx.zenMode} onToggleZen={ctx.onToggleZen} />
      <SongSaveModalHost
        saveModalOpen={ctx.saveModalOpen}
        setSaveModalOpen={ctx.setSaveModalOpen}
        folders={ctx.folders}
        currentSong={ctx.currentSong}
        newFolderName={ctx.newFolderName}
        setNewFolderName={ctx.setNewFolderName}
        onCreateFolderFromSave={ctx.onCreateFolderFromSave}
        onToggleSongInFolder={ctx.onToggleSongInFolder}
      />
      <SongMain {...ctx} />
      <SongOverlays
        activeChord={ctx.activeChord}
        setActiveChord={ctx.setActiveChord}
        mirrored={ctx.mirrored}
        capo={ctx.capo}
        youtubeMiniOpen={ctx.youtubeMiniOpen}
        setYoutubeMiniOpen={ctx.setYoutubeMiniOpen}
        youtubeEmbedUrl={ctx.youtubeEmbedUrl}
        isParsing={ctx.isParsing}
        parseError={ctx.parseError}
        youtubeFallbackSearchQuery={ctx.youtubeFallbackSearchQuery}
        onYoutubeVideoResolved={ctx.onYoutubeVideoResolved}
        currentSong={ctx.currentSong}
      />
    </div>
  );
}
