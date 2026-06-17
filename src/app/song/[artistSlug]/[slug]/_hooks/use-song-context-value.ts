import { useMemo } from "react";
import type { Section, StoredSong } from "@/lib/types";
import type { useSongFolderActions } from "./use-song-folder-actions";
import type { useSongPageActions } from "./use-song-page-actions";

export function useSongContextValue({
  currentSong,
  songData,
  folderState,
  actions,
}: {
  currentSong: StoredSong | null;
  songData: Section[];
  folderState: ReturnType<typeof useSongFolderActions>;
  actions: ReturnType<typeof useSongPageActions>;
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
  }), [actions, currentSong, folderState, p, songData, youtubeEmbedUrl]);
}
