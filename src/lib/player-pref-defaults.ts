export const PLAYER_PREF_DEFAULTS = {
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

export const PLAYER_PREF_KEYS = Object.keys(PLAYER_PREF_DEFAULTS) as Array<keyof typeof PLAYER_PREF_DEFAULTS>;

export type PlayerPrefs = typeof PLAYER_PREF_DEFAULTS;
