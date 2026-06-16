import { create } from "zustand";
import type { Folder, StoredSong, SetlistSummary, LocalSetlistStored } from "@/lib/types";
import { DEFAULT_FOLDERS } from "@/lib/storage";
import { dedupeRecentesBySong } from "@/lib/stored-song-key";

interface LibraryState {
  folders: Folder[];
  recentes: StoredSong[];
  localSetlistsRaw: LocalSetlistStored[];
  setlistSummaries: SetlistSummary[];
  libraryLoaded: boolean;

  // Actions
  setFolders: (folders: Folder[]) => void;
  setRecentes: (recentes: StoredSong[]) => void;
  setLocalSetlistsRaw: (localSetlistsRaw: LocalSetlistStored[]) => void;
  setSetlistSummaries: (summaries: SetlistSummary[]) => void;
  setLibraryLoaded: (loaded: boolean) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  folders: DEFAULT_FOLDERS,
  recentes: [],
  localSetlistsRaw: [],
  setlistSummaries: [],
  libraryLoaded: false,

  setFolders: (folders) => set({ folders }),
  setRecentes: (recentes) => set({ recentes: dedupeRecentesBySong(recentes) }),
  setLocalSetlistsRaw: (localSetlistsRaw) => set({ localSetlistsRaw }),
  setSetlistSummaries: (setlistSummaries) => set({ setlistSummaries }),
  setLibraryLoaded: (libraryLoaded) => set({ libraryLoaded }),
}));
