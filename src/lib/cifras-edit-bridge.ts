import type {
  CurrentSongMeta,
  Section,
  SetlistDetailView,
  SearchResultArtist,
} from "@/lib/types";

type SongReturnTargetBridge =
  | "home"
  | "folder"
  | "artist"
  | "setlist";

const SNAPSHOT_KEY = "cifras-edit-snapshot";
const RESULT_KEY = "cifras-edit-result";

export type CifrasEditSnapshot = {
  v: 1;
  currentSong: CurrentSongMeta;
  songData: Section[];
  songReturnTarget: SongReturnTargetBridge;
  activeFolderId: string | null;
  setlistDetail: SetlistDetailView | null;
  activeArtist: SearchResultArtist | null;
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

export function writeEditResult(sections: Section[]): void {
  sessionStorage.setItem(RESULT_KEY, JSON.stringify(sections));
}
