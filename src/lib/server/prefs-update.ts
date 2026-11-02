import type { StoredSong, StoredSongUiPrefs } from "@/lib/types";

export type ValidatedPrefs = {
  arrangementId: string;
  tone: number;
  capo: number;
  uiPrefs: StoredSongUiPrefs | null;
};

/** songData só é gravado em sincronização explícita de conteúdo; prefs nunca sobrescrevem a cifra. */
export function prefsUpdateSet(prefs: ValidatedPrefs, song: StoredSong | null, syncContent: boolean, now: Date) {
  return {
    tone: prefs.tone,
    capo: prefs.capo,
    uiPrefs: prefs.uiPrefs,
    ...(syncContent && song ? { songData: song.songData } : {}),
    updatedAt: now,
  };
}
