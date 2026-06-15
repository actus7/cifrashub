"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SongView } from "@/components/song/song-view";
import { SongViewProvider, type SongViewContextValue } from "@/components/song/song-context";
import { usePlayerStore } from "@/store/use-player-store";
import { useLibraryStore } from "@/store/use-library-store";
import type { Section, StoredSong } from "@/lib/types";
import { fetchChordsHtml } from "@/lib/fetch-proxy";
import { processHtmlAndExtract } from "@/lib/parser";
import { SongPageSkeleton } from "@/components/song/song-page-skeleton";
import { SongPageError } from "@/components/song/song-page-error";
import { useLibraryActions } from "@/hooks/use-library-actions";
import { useSession } from "@/hooks/use-session";
import { cloudAddSongToFolder, cloudRemoveSongFromFolder, saveFolders } from "@/lib/storage";
import { writeEditSnapshot } from "@/lib/cifras-edit-bridge";

export default function SongPage() {
  const params = useParams();
  const router = useRouter();

  // Next.js app router params
  const artistSlug = Array.isArray(params.artistSlug) ? params.artistSlug[0] : params.artistSlug;
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const [currentSong, setCurrentSong] = useState<StoredSong | null>(null);
  const [songData, setSongData] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { status } = useSession();
  const isCloud = status === "authenticated";
  const { addToRecentes, doCreateFolder, notifyCloudMutation } = useLibraryActions();

  // Zustand — seletores individuais para memoização correta
  const setFolders = useLibraryStore((s) => s.setFolders);
  const folders = useLibraryStore((s) => s.folders);

  const tone = usePlayerStore((s) => s.tone);
  const setTone = usePlayerStore((s) => s.setTone);
  const capo = usePlayerStore((s) => s.capo);
  const setCapo = usePlayerStore((s) => s.setCapo);
  const simplified = usePlayerStore((s) => s.simplified);
  const setSimplified = usePlayerStore((s) => s.setSimplified);
  const showTabs = usePlayerStore((s) => s.showTabs);
  const setShowTabs = usePlayerStore((s) => s.setShowTabs);
  const mirrored = usePlayerStore((s) => s.mirrored);
  const setMirrored = usePlayerStore((s) => s.setMirrored);
  const fontSizeOffset = usePlayerStore((s) => s.fontSizeOffset);
  const setFontSizeOffset = usePlayerStore((s) => s.setFontSizeOffset);
  const columns = usePlayerStore((s) => s.columns);
  const setColumns = usePlayerStore((s) => s.setColumns);
  const spacingOffset = usePlayerStore((s) => s.spacingOffset);
  const setSpacingOffset = usePlayerStore((s) => s.setSpacingOffset);
  const zenMode = usePlayerStore((s) => s.zenMode);
  const setZenMode = usePlayerStore((s) => s.setZenMode);
  const autoScroll = usePlayerStore((s) => s.autoScroll);
  const setAutoScroll = usePlayerStore((s) => s.setAutoScroll);
  const scrollSpeed = usePlayerStore((s) => s.scrollSpeed);
  const setScrollSpeed = usePlayerStore((s) => s.setScrollSpeed);
  const metronomeActive = usePlayerStore((s) => s.metronomeActive);
  const setMetronomeActive = usePlayerStore((s) => s.setMetronomeActive);
  const bpm = usePlayerStore((s) => s.bpm);
  const setBpm = usePlayerStore((s) => s.setBpm);
  const activeChord = usePlayerStore((s) => s.activeChord);
  const setActiveChord = usePlayerStore((s) => s.setActiveChord);
  const displaySettingsOpen = usePlayerStore((s) => s.displaySettingsOpen);
  const setDisplaySettingsOpen = usePlayerStore((s) => s.setDisplaySettingsOpen);
  const youtubeMiniOpen = usePlayerStore((s) => s.youtubeMiniOpen);
  const setYoutubeMiniOpen = usePlayerStore((s) => s.setYoutubeMiniOpen);
  const resetPlayer = usePlayerStore((s) => s.reset);

  const load = async () => {
    if (!artistSlug || !slug) return;
    try {
        setIsLoading(true);
        setError(null);
        const html = await fetchChordsHtml(artistSlug, slug);
        const songObj = processHtmlAndExtract(html, `${artistSlug}-${slug}`, "", "", artistSlug, slug);
        setCurrentSong(songObj);
        setSongData(songObj.songData);
        resetPlayer();
        addToRecentes(songObj);
    } catch (err) {
        setError(err instanceof Error ? err : new Error("Erro desconhecido."));
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistSlug, slug]);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const isSavedInAnyFolder = currentSong ? folders.some((f) =>
    f.songs.some((s) => s.artistSlug === currentSong.artistSlug && s.slug === currentSong.slug)
  ) : false;

  const onToggleSongInFolder = useCallback(async (folderId: string) => {
    const isSaved = folders.some((f) =>
      f.id === folderId &&
      f.songs.some((s) => s.artistSlug === currentSong?.artistSlug && s.slug === currentSong?.slug)
    );

    if (isCloud) {
      try {
        if (isSaved) {
          const folder = folders.find(f => f.id === folderId);
          const songInFolder = folder?.songs.find(s => s.artistSlug === currentSong?.artistSlug && s.slug === currentSong?.slug);
          if (songInFolder) {
            const { folders: next } = await cloudRemoveSongFromFolder(folderId, songInFolder.arrangementId || songInFolder.id);
            setFolders(next);
            notifyCloudMutation();
          }
        } else if (currentSong) {
          const { folders: next } = await cloudAddSongToFolder(folderId, currentSong);
          setFolders(next);
          notifyCloudMutation();
        }
      } catch (err) {
        console.error("Error toggling folder", err);
      }
    } else {
      const next = folders.map(f => {
        if (f.id === folderId) {
          if (isSaved) {
            return { ...f, songs: f.songs.filter(s => !(s.artistSlug === currentSong?.artistSlug && s.slug === currentSong?.slug)) };
          } else if (currentSong) {
            return { ...f, songs: [...f.songs, currentSong] };
          }
        }
        return f;
      });
      saveFolders(next);
      setFolders(next);
    }
  }, [currentSong, folders, isCloud, notifyCloudMutation, setFolders]);

  const onCreateFolderFromSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await doCreateFolder(newFolderName.trim());
    setNewFolderName("");
  }, [doCreateFolder, newFolderName]);

  const youtubeEmbedUrl = currentSong?.youtubeId ? `https://www.youtube.com/embed/${currentSong.youtubeId}` : null;

  const value = useMemo(() => ({
      currentSong,
      songData,
      isParsing: false,
      parseError: null,
      tone,
      setTone,
      capo,
      setCapo,
      simplified,
      setSimplified,
      showTabs,
      setShowTabs,
      mirrored,
      setMirrored,
      fontSizeOffset,
      setFontSizeOffset,
      columns,
      setColumns,
      spacingOffset,
      setSpacingOffset,
      effectiveTransposition: tone - capo,
      zenMode,
      autoScroll,
      setAutoScroll,
      scrollSpeed,
      setScrollSpeed,
      metronomeActive,
      setMetronomeActive,
      bpm,
      setBpm,
      activeChord,
      setActiveChord,
      displaySettingsOpen,
      setDisplaySettingsOpen,
      saveModalOpen,
      setSaveModalOpen,
      youtubeMiniOpen,
      setYoutubeMiniOpen,
      folders,
      newFolderName,
      setNewFolderName,
      isSavedInAnyFolder,
      onToggleSongInFolder,
      onCreateFolderFromSave,
      youtubeEmbedUrl,
      youtubeFallbackSearchQuery: currentSong ? currentSong.title + " " + currentSong.artist : "",
      onYoutubeVideoResolved: (youtubeId: string) => {
         setCurrentSong(prev => prev ? { ...prev, youtubeId } : prev);
      },
      onBack: () => router.back(),
      onOpenVideo: () => setYoutubeMiniOpen(true),
      onOpenArtistSongs: () => {
        if (currentSong) router.push(`/artist/${currentSong.artistSlug}`);
      },
      onPrint: () => window.print(),
      onTapZone: () => {},
      onToggleZen: () => {
          // Lê direto do store para evitar stale closure
          const current = usePlayerStore.getState().zenMode;
          setZenMode(!current);
      },
      onOpenSongEditor: () => {
          if (!currentSong) return;
          const ps = usePlayerStore.getState();
          writeEditSnapshot({
            v: 1,
            currentSong,
            songData,
            songReturnTarget: "home",
            activeFolderId: null,
            setlistDetail: null,
            activeArtist: null,
            display: {
                tone: ps.tone,
                capo: ps.capo,
                simplified: ps.simplified,
                showTabs: ps.showTabs,
                mirrored: ps.mirrored,
                fontSizeOffset: ps.fontSizeOffset,
                columns: ps.columns,
                spacingOffset: ps.spacingOffset,
            }
          });
          router.push("/editar");
      },
      onShareArrangement: () => {
         if (typeof window !== "undefined" && navigator?.clipboard) {
            navigator.clipboard.writeText(window.location.href);
         }
      },
      shareArrangementDisabled: false,
  }), [
    currentSong, songData,
    tone, setTone, capo, setCapo, simplified, setSimplified,
    showTabs, setShowTabs, mirrored, setMirrored,
    fontSizeOffset, setFontSizeOffset, columns, setColumns,
    spacingOffset, setSpacingOffset, zenMode, setZenMode,
    autoScroll, setAutoScroll, scrollSpeed, setScrollSpeed,
    metronomeActive, setMetronomeActive, bpm, setBpm,
    activeChord, setActiveChord, displaySettingsOpen, setDisplaySettingsOpen,
    saveModalOpen, youtubeMiniOpen, setYoutubeMiniOpen,
    folders, newFolderName, isSavedInAnyFolder, youtubeEmbedUrl,
    onToggleSongInFolder, onCreateFolderFromSave, router,
  ]);

  if (isLoading) return <SongPageSkeleton />;
  if (error) return <SongPageError error={error} onRetry={load} />;
  if (!currentSong) return <SongPageError error={new Error("Cifra não encontrada.")} onRetry={load} />;

  return (
    <SongViewProvider value={value as SongViewContextValue}>
       <SongView />
    </SongViewProvider>
  );
}
