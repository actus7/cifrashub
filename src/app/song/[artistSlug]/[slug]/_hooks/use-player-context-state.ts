import { usePlayerStore } from "@/store/use-player-store";

export type PlayerContextState = ReturnType<typeof usePlayerContextState>;

function usePitchState() {
  return {
    tone: usePlayerStore((s) => s.tone),
    setTone: usePlayerStore((s) => s.setTone),
    capo: usePlayerStore((s) => s.capo),
    setCapo: usePlayerStore((s) => s.setCapo),
  };
}

function useDisplayState() {
  return {
    simplified: usePlayerStore((s) => s.simplified),
    setSimplified: usePlayerStore((s) => s.setSimplified),
    showTabs: usePlayerStore((s) => s.showTabs),
    setShowTabs: usePlayerStore((s) => s.setShowTabs),
    nashvilleNumbers: usePlayerStore((s) => s.nashvilleNumbers),
    setNashvilleNumbers: usePlayerStore((s) => s.setNashvilleNumbers),
    mirrored: usePlayerStore((s) => s.mirrored),
    setMirrored: usePlayerStore((s) => s.setMirrored),
    fontSizeOffset: usePlayerStore((s) => s.fontSizeOffset),
    setFontSizeOffset: usePlayerStore((s) => s.setFontSizeOffset),
    columns: usePlayerStore((s) => s.columns),
    setColumns: usePlayerStore((s) => s.setColumns),
    spacingOffset: usePlayerStore((s) => s.spacingOffset),
    setSpacingOffset: usePlayerStore((s) => s.setSpacingOffset),
  };
}

function usePracticeState() {
  return {
    zenMode: usePlayerStore((s) => s.zenMode),
    setZenMode: usePlayerStore((s) => s.setZenMode),
    autoScroll: usePlayerStore((s) => s.autoScroll),
    setAutoScroll: usePlayerStore((s) => s.setAutoScroll),
    scrollSpeed: usePlayerStore((s) => s.scrollSpeed),
    setScrollSpeed: usePlayerStore((s) => s.setScrollSpeed),
    metronomeActive: usePlayerStore((s) => s.metronomeActive),
    setMetronomeActive: usePlayerStore((s) => s.setMetronomeActive),
    bpm: usePlayerStore((s) => s.bpm),
    setBpm: usePlayerStore((s) => s.setBpm),
  };
}

function useOverlayState() {
  return {
    activeChord: usePlayerStore((s) => s.activeChord),
    setActiveChord: usePlayerStore((s) => s.setActiveChord),
    displaySettingsOpen: usePlayerStore((s) => s.displaySettingsOpen),
    setDisplaySettingsOpen: usePlayerStore((s) => s.setDisplaySettingsOpen),
    youtubeMiniOpen: usePlayerStore((s) => s.youtubeMiniOpen),
    setYoutubeMiniOpen: usePlayerStore((s) => s.setYoutubeMiniOpen),
  };
}

export function usePlayerContextState() {
  return {
    ...usePitchState(),
    ...useDisplayState(),
    ...usePracticeState(),
    ...useOverlayState(),
  };
}
