import type { CurrentSongMeta, Section } from "@/lib/types";

const SNAPSHOT_KEY = "cifras-edit-snapshot";
const RESULT_KEY = "cifras-edit-result";

export type EditOrigin = {
  artistSlug: string;
  slug: string;
  folderId: string | null;
  arrangementId: string | null;
};

export type CifrasEditSnapshot = {
  v: 1;
  currentSong: CurrentSongMeta;
  songData: Section[];
  origin: EditOrigin;
  display: {
    tone: number;
    capo: number;
    simplified: boolean;
    showTabs: boolean;
    mirrored: boolean;
    fontSizeOffset: number;
    columns: number;
    spacingOffset: number;
  };
};

export type CifrasEditResult = {
  origin: EditOrigin;
  songData: Section[];
};

export function writeEditSnapshot(s: CifrasEditSnapshot): void {
  sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
}

export function readEditSnapshot(): CifrasEditSnapshot | null {
  const raw = sessionStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CifrasEditSnapshot;
  } catch {
    return null;
  }
}

export function writeEditResult(origin: EditOrigin, sections: Section[]): void {
  sessionStorage.setItem(RESULT_KEY, JSON.stringify({ origin, songData: sections }));
}

export function readEditResult(): CifrasEditResult | null {
  const raw = sessionStorage.getItem(RESULT_KEY);
  sessionStorage.removeItem(RESULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CifrasEditResult;
  } catch {
    return null;
  }
}
