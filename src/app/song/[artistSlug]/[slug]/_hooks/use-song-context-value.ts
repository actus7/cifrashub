import { useMemo } from "react";
import type { Section, SongVersion, StoredSong } from "@/lib/types";
import type { useSongFolderActions } from "./use-song-folder-actions";
import type { useSongPageActions } from "./use-song-page-actions";

export type SongVersionState = {
  songVersion: SongVersion;
  setSongVersion: (v: SongVersion) => void;
  onReloadOriginal: () => void;
  onResetSaved: () => void;
  onResetCache: () => void;
  versionActionPending: boolean;
  hasSavedVersion: boolean;
};

export function useSongContextValue({
  currentSong,
  songData,
  folderState,
  actions,
  versionState,
  sharedContext,
}: {
  currentSong: StoredSong | null;
  songData: Section[];
  folderState: ReturnType<typeof useSongFolderActions>;
  actions: ReturnType<typeof useSongPageActions>;
  versionState: SongVersionState;
  sharedContext?: { ownerName: string | null } | null;
}) {
  const p = actions.player;
  const youtubeEmbedUrl = currentSong?.youtubeId ? `https://www.youtube.com/embed/${currentSong.youtubeId}` : null;

  return useMemo(() => ({
    currentSong,
    songData,
    isParsing: false,
    parseError: null,
    ...p,
    effectiveTransposition: p.tone - p.capo,
    ...folderState,
    youtubeEmbedUrl,
    youtubeFallbackSearchQuery: currentSong ? currentSong.title + " " + currentSong.artist : "",
    onYoutubeVideoResolved: actions.onYoutubeVideoResolved,
    onBack: actions.onBack,
    onOpenVideo: actions.onOpenVideo,
    onOpenArtistSongs: actions.onOpenArtistSongs,
    onPrint: actions.onPrint,
    onTapZone: actions.onTapZone,
    onToggleZen: actions.onToggleZen,
    onOpenSongEditor: actions.onOpenSongEditor,
    onShareArrangement: actions.onShareArrangement,
    shareArrangementDisabled: false,
    songVersion: versionState.songVersion,
    setSongVersion: versionState.setSongVersion,
    onReloadOriginal: versionState.onReloadOriginal,
    onResetSaved: versionState.onResetSaved,
    onResetCache: versionState.onResetCache,
    versionActionPending: versionState.versionActionPending,
    hasSavedVersion: versionState.hasSavedVersion,
    sharedContext: sharedContext ?? null,
  }), [actions, currentSong, folderState, p, sharedContext, songData, versionState, youtubeEmbedUrl]);
}
