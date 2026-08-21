"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { CurrentSongMeta, Folder, Section, SongVersion } from "@/lib/types";

/**
 * Valor completo do contexto da view de cifra.
 * Elimina o prop-drilling de 45+ props entre CifrasApp → SongView → SongHeader/Toolbar/Display.
 */
export type SongViewContextValue = {
  // ─── Dados da música ───────────────────────────────────────────────────────
  currentSong: CurrentSongMeta;
  songData: Section[];
  isParsing: boolean;
  parseError: string | null;

  // ─── Versão da cifra (salva/cache/original) ────────────────────────────────
  /** Versão atualmente em exibição. */
  songVersion: SongVersion;
  /** Define a versão em exibição ("saved" volta para a versão personalizada). */
  setSongVersion: (v: SongVersion) => void;
  /** Carrega o original direto da fonte, ignorando cache local/servidor. */
  onReloadOriginal: () => void;
  /** Restaura a versão salva para o estado de origem (parse fresco da fonte). */
  onResetSaved: () => void;
  /** Limpa o cache do servidor para esta cifra e recarrega da fonte. */
  onResetCache: () => void;
  /** Indica carregamento em curso de original/reset. */
  versionActionPending: boolean;
  /** A cifra em exibição é uma versão salva/personalizada. */
  hasSavedVersion: boolean;

  // ─── Configurações de exibição ─────────────────────────────────────────────
  tone: number;
  setTone: (v: number) => void;
  capo: number;
  setCapo: (v: number) => void;
  simplified: boolean;
  setSimplified: (v: boolean) => void;
  showTabs: boolean;
  setShowTabs: (v: boolean) => void;
  nashvilleNumbers: boolean;
  setNashvilleNumbers: (v: boolean) => void;
  mirrored: boolean;
  setMirrored: (v: boolean) => void;
  fontSizeOffset: number;
  setFontSizeOffset: (v: number) => void;
  columns: number;
  setColumns: (v: number) => void;
  spacingOffset: number;
  setSpacingOffset: (v: number) => void;
  /** Transposição efetiva = tone - capo (para display do SongContent). */
  effectiveTransposition: number;

  // ─── Playback ──────────────────────────────────────────────────────────────
  zenMode: boolean;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  scrollSpeed: number;
  setScrollSpeed: (v: number) => void;
  metronomeActive: boolean;
  setMetronomeActive: (v: boolean) => void;
  bpm: number;
  setBpm: (v: number) => void;


  // ─── Estado de UI ──────────────────────────────────────────────────────────
  activeChord: string | null;
  setActiveChord: (c: string | null) => void;
  displaySettingsOpen: boolean;
  setDisplaySettingsOpen: (v: boolean) => void;
  saveModalOpen: boolean;
  setSaveModalOpen: (v: boolean) => void;
  youtubeMiniOpen: boolean;
  setYoutubeMiniOpen: (v: boolean) => void;

  // ─── Pastas & salvar ───────────────────────────────────────────────────────
  folders: Folder[];
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  isSavedInAnyFolder: boolean;
  onToggleSongInFolder: (folderId: string) => void;
  onCreateFolderFromSave: (e: React.FormEvent) => void;

  // ─── YouTube ───────────────────────────────────────────────────────────────
  youtubeEmbedUrl: string | null;
  youtubeFallbackSearchQuery: string;
  onYoutubeVideoResolved?: (videoId: string) => void;

  // ─── Navegação & ações ────────────────────────────────────────────────────
  onBack: () => void;
  onOpenVideo: () => void;
  onOpenArtistSongs: () => void;
  onPrint: () => void;
  onTapZone: (e: React.MouseEvent<HTMLDivElement>) => void;
  onToggleZen: () => void;
  onOpenSongEditor?: () => void;
  onShareArrangement?: () => void;
  shareArrangementDisabled?: boolean;
};

const SongViewContext = createContext<SongViewContextValue | null>(null);

export function SongViewProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: SongViewContextValue;
}) {
  return (
    <SongViewContext.Provider value={value}>
      {children}
    </SongViewContext.Provider>
  );
}

export function useSongViewContext(): SongViewContextValue {
  const ctx = useContext(SongViewContext);
  if (!ctx) {
    throw new Error("useSongViewContext deve ser usado dentro de SongViewProvider");
  }
  return ctx;
}
