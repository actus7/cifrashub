import { create } from "zustand";
import type { StoredSong } from "@/lib/types";

const PLAYER_PREF_DEFAULTS = {
  tone: 0,
  capo: 0,
  simplified: false,
  showTabs: true,
  mirrored: false,
  fontSizeOffset: 0,
  columns: 1,
  spacingOffset: 0,
  zenMode: false,
  autoScroll: false,
  scrollSpeed: 2,
  metronomeActive: false,
  bpm: 100,
};

const PLAYER_PREF_KEYS = Object.keys(PLAYER_PREF_DEFAULTS) as Array<keyof typeof PLAYER_PREF_DEFAULTS>;

type PlayerPrefs = typeof PLAYER_PREF_DEFAULTS;

function playerPrefsFromSong(song: StoredSong): PlayerPrefs {
  return Object.fromEntries(PLAYER_PREF_KEYS.map((key) => [key, song[key] ?? PLAYER_PREF_DEFAULTS[key]])) as PlayerPrefs;
}

interface PlayerState {
  tone: number;
  capo: number;
  simplified: boolean;
  activeChord: string | null;
  showTabs: boolean;
  mirrored: boolean;
  fontSizeOffset: number;
  columns: number;
  spacingOffset: number;

  zenMode: boolean;
  autoScroll: boolean;
  scrollSpeed: number;
  displaySettingsOpen: boolean;

  metronomeActive: boolean;
  bpm: number;

  youtubeMiniOpen: boolean;

  // Actions
  setTone: (tone: number) => void;
  setCapo: (capo: number) => void;
  setSimplified: (simplified: boolean) => void;
  setActiveChord: (chord: string | null) => void;
  setShowTabs: (show: boolean) => void;
  setMirrored: (mirrored: boolean) => void;
  setFontSizeOffset: (offset: number) => void;
  setColumns: (columns: number) => void;
  setSpacingOffset: (offset: number) => void;

  setZenMode: (zenMode: boolean) => void;
  toggleZenMode: () => void;
  setAutoScroll: (autoScroll: boolean) => void;
  toggleAutoScroll: () => void;
  setScrollSpeed: (speed: number) => void;
  setDisplaySettingsOpen: (open: boolean) => void;

  setMetronomeActive: (active: boolean) => void;
  setBpm: (bpm: number) => void;

  setYoutubeMiniOpen: (open: boolean) => void;
  applySongPrefs: (song: StoredSong) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  tone: 0,
  capo: 0,
  simplified: false,
  activeChord: null,
  showTabs: true,
  mirrored: false,
  fontSizeOffset: 0,
  columns: 1,
  spacingOffset: 0,

  zenMode: false,
  autoScroll: false,
  scrollSpeed: 2,
  displaySettingsOpen: false,

  metronomeActive: false,
  bpm: 100,

  youtubeMiniOpen: false,

  setTone: (tone) => set({ tone }),
  setCapo: (capo) => set({ capo }),
  setSimplified: (simplified) => set({ simplified }),
  setActiveChord: (activeChord) => set({ activeChord }),
  setShowTabs: (showTabs) => set({ showTabs }),
  setMirrored: (mirrored) => set({ mirrored }),
  setFontSizeOffset: (fontSizeOffset) => set({ fontSizeOffset }),
  setColumns: (columns) => set({ columns }),
  setSpacingOffset: (spacingOffset) => set({ spacingOffset }),

  setZenMode: (zenMode) => set({ zenMode }),
  toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),
  setAutoScroll: (autoScroll) => set({ autoScroll }),
  toggleAutoScroll: () => set((state) => ({ autoScroll: !state.autoScroll })),
  setScrollSpeed: (scrollSpeed) => set({ scrollSpeed }),
  setDisplaySettingsOpen: (displaySettingsOpen) => set({ displaySettingsOpen }),

  setMetronomeActive: (metronomeActive) => set({ metronomeActive }),
  setBpm: (bpm) => set({ bpm }),

  setYoutubeMiniOpen: (youtubeMiniOpen) => set({ youtubeMiniOpen }),
  applySongPrefs: (song) => set({
    ...playerPrefsFromSong(song),
    activeChord: null,
    displaySettingsOpen: false,
    youtubeMiniOpen: false,
  }),
  reset: () => set({
    ...PLAYER_PREF_DEFAULTS,
    activeChord: null,
    displaySettingsOpen: false,
    youtubeMiniOpen: false,
  }),
}));
