import { create } from "zustand";
import type { Folder, StoredSong, SetlistSummary, LocalSetlistStored } from "@/lib/types";
import { DEFAULT_FOLDERS } from "@/lib/storage";
import type { SharedSummary } from "@/lib/cloud-api";
import { dedupeRecentesBySong } from "@/lib/dedupe-recentes-by-song";

interface LibraryState {
  folders: Folder[];
  recentes: StoredSong[];
  localSetlistsRaw: LocalSetlistStored[];
  setlistSummaries: SetlistSummary[];
  libraryLoaded: boolean;
  sharedFolders: SharedSummary["folders"];
  sharedSetlists: SharedSummary["setlists"];

  // Actions
  setFolders: (folders: Folder[]) => void;
  setRecentes: (recentes: StoredSong[]) => void;
  setLocalSetlistsRaw: (localSetlistsRaw: LocalSetlistStored[]) => void;
  setSetlistSummaries: (summaries: SetlistSummary[]) => void;
  setLibraryLoaded: (loaded: boolean) => void;
  setSharedSummary: (summary: SharedSummary) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  folders: DEFAULT_FOLDERS,
  recentes: [],
  localSetlistsRaw: [],
  setlistSummaries: [],
  libraryLoaded: false,
  sharedFolders: [],
  sharedSetlists: [],

  setFolders: (folders) => set({ folders }),
  setRecentes: (recentes) => set({ recentes: dedupeRecentesBySong(recentes) }),
  setLocalSetlistsRaw: (localSetlistsRaw) => set({ localSetlistsRaw }),
  setSetlistSummaries: (setlistSummaries) => set({ setlistSummaries }),
  setLibraryLoaded: (libraryLoaded) => set({ libraryLoaded }),
  setSharedSummary: (summary) => set({ sharedFolders: summary.folders, sharedSetlists: summary.setlists }),
}));
