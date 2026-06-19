export type SectionType =
  | "intro"
  | "verse"
  | "chorus"
  | "bridge"
  | "tab"
  | "solo"
  | "outro"
  | "pre-chorus";

export interface LyricBlock {
  chord: string;
  text: string;
  spaceAfter?: boolean;
  isTab?: boolean;
}

/** One line of the song: chord blocks aligned with lyrics */
export type LyricLine = LyricBlock[];

export interface Section {
  type: SectionType;
  label: string;
  content: LyricLine[];
}

export interface SearchResultSong {
  type: "song";
  title: string;
  artistName: string;
  verified: boolean;
  artistSlug: string;
  slug: string;
}

export interface SearchResultArtist {
  type: "artist";
  artistName: string;
  artistSlug: string;
}

export interface CurrentSongMeta {
  id: string;
  /** Instância única da cifra salva (pastas, recentes, setlists). Legado: omitido → usa `id`. */
  arrangementId?: string;
  title: string;
  artist: string;
  artistSlug: string;
  slug: string;
  youtubeId?: string;
  /** Tom em que a cifra está escrita no Cifra Club (ex.: G). */
  cifraWrittenKey?: string;
  /** Tom que soa com o capo indicado (ex.: A com capo 2 em G). */
  cifraSoundingKey?: string;
  /** Casa do capotraste sugerida pelo Cifra Club (0 = sem capo). */
  cifraCapo?: number;
}

/** Preferências de exibição persistidas com a cifra (local + nuvem em `ui_prefs`). */
export type StoredSongUiPrefs = {
  simplified?: boolean;
  showTabs?: boolean;
  mirrored?: boolean;
  fontSizeOffset?: number;
  columns?: number;
  spacingOffset?: number;
  zenMode?: boolean;
  autoScroll?: boolean;
  scrollSpeed?: number;
  metronomeActive?: boolean;
  bpm?: number;
};

export interface StoredSong extends CurrentSongMeta {
  songData: Section[];
  /** Cópia opcional da chave de origem (import); legado deriva de artistSlug/slug. */
  sourceArtistSlug?: string;
  sourceSlug?: string;
  tone?: number;
  capo?: number;
  simplified?: boolean;
  showTabs?: boolean;
  mirrored?: boolean;
  fontSizeOffset?: number;
  columns?: number;
  spacingOffset?: number;
  zenMode?: boolean;
  autoScroll?: boolean;
  scrollSpeed?: number;
  metronomeActive?: boolean;
  bpm?: number;
}

export interface Folder {
  id: string;
  title: string;
  songs: StoredSong[];
  /** Pasta padrão (ex.: Favoritos); não deve ser excluída. */
  isDefault?: boolean;
}

/** Resumo de setlist (lista na home / API). */
export interface SetlistSummary {
  id: string;
  title: string;
  description: string | null;
  position: number;
  updatedAt: string;
}

/** Item de setlist com música resolvida (detalhe). */
export interface SetlistItemView {
  itemId: string;
  position: number;
  arrangementId: string;
  notes: string | null;
  song: StoredSong | null;
}

export interface SetlistDetailView extends SetlistSummary {
  items: SetlistItemView[];
}

/** Setlist só em localStorage (visitante). */
export interface LocalSetlistStored {
  id: string;
  title: string;
  description?: string | null;
  items: Array<{
    itemId: string;
    arrangementId: string;
    position?: number;
    notes?: string | null;
  }>;
}

interface ChordBarre {
  fret: number;
  from: number;
  to: number;
}

export interface ChordShape {
  frets: Array<number | "x">;
  fingers: Array<number | "">;
  barre?: ChordBarre;
  base?: number;
}
