"use client";

import { SongView } from "@/components/song/song-view";
import { SongViewProvider, type SongViewContextValue } from "@/components/song/song-context";
import { SongPageSkeleton } from "@/components/song/song-page-skeleton";
import { SongPageError } from "@/components/song/song-page-error";
import { useApplyEditResult } from "./_hooks/use-apply-edit-result";
import { useLoadedSong } from "./_hooks/use-loaded-song";
import { usePersistCloudSongPrefs, usePersistCurrentSongPrefs } from "./_hooks/use-song-prefs-persistence";
import { useSongContextValue } from "./_hooks/use-song-context-value";
import { useSongFolderActions } from "./_hooks/use-song-folder-actions";
import { useSongPageActions } from "./_hooks/use-song-page-actions";
import { useSongParams } from "./_hooks/use-song-params";

export default function SongPage() {
  const { artistSlug, slug } = useSongParams();
  const songState = useLoadedSong(artistSlug, slug);
  const folderState = useSongFolderActions(songState.currentSong);
  const actions = useSongPageActions(
    songState.currentSong,
    songState.songData,
    songState.setCurrentSong,
    songState.folderId,
    songState.arrangementId,
  );
  usePersistCurrentSongPrefs(songState.currentSong, songState.setCurrentSong, actions.player);
  usePersistCloudSongPrefs(songState.currentSong, actions.player);
  useApplyEditResult(
    artistSlug,
    slug,
    songState.folderId,
    songState.arrangementId,
    songState.currentSong,
    songState.setCurrentSong,
    songState.setSongData,
  );
  const value = useSongContextValue({ currentSong: songState.currentSong, songData: songState.songData, folderState, actions });

  if (songState.isLoading) return <SongPageSkeleton />;
  if (songState.error) return <SongPageError error={songState.error} onRetry={songState.load} />;
  if (!songState.currentSong) return <SongPageError error={new Error("Cifra não encontrada.")} onRetry={songState.load} />;

  return (
    <SongViewProvider value={value as SongViewContextValue}>
      <SongView />
    </SongViewProvider>
  );
}
