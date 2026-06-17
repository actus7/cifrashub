"use client";

import { Bookmark, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeaderControl } from "@/components/auth/user-menu";
import { InstallAppBanner } from "@/components/install-app-banner";
import { SetlistsHomeSection } from "@/components/setlist/setlists-home-section";
import { useLibraryActions } from "@/hooks/use-library-actions";
import { arrangementKey } from "@/lib/arrangement-key";
import { useSearchDebounced } from "@/hooks/use-search";
import { cloudCreateSetlist, cloudDeleteSetlist } from "@/lib/storage";
import type { SearchResultArtist, SearchResultSong, StoredSong } from "@/lib/types";
import { useLibraryStore } from "@/store/use-library-store";
import { FolderGrid } from "./folder-grid";
import { RecentList } from "./recent-list";
import { SearchBar } from "./search-bar";

function HomeHeader() {
  return (
    <header className="relative z-10 flex w-full items-center justify-end p-5">
      <AuthHeaderControl />
    </header>
  );
}

function HomeHero({
  searchQuery,
  setSearchQuery,
  results,
  isSearching,
  onSelectSearchResult,
  onSelectArtistResult,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  results: ReturnType<typeof useSearchDebounced>["results"];
  isSearching: boolean;
  onSelectSearchResult: (res: SearchResultSong) => void;
  onSelectArtistResult: (res: SearchResultArtist) => void;
}) {
  return (
    <div className="mb-14 flex w-full flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-10 flex items-center gap-4">
        <Image
          src="/logo-mark.png"
          alt="CifrasHub"
          width={64}
          height={64}
          className="h-16 w-16 object-contain"
          priority
        />
        <h1 className="text-5xl font-extrabold tracking-tight text-foreground md:text-6xl">
          Cifras<span className="text-primary">Hub</span>
        </h1>
      </div>
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        results={results}
        isSearching={isSearching}
        onSelect={onSelectSearchResult}
        onSelectArtist={onSelectArtistResult}
      />
      <InstallAppBanner />
    </div>
  );
}

function LibraryLoading() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="text-sm">Carregando biblioteca…</p>
    </div>
  );
}

function FoldersSection({
  folders,
  isCreatingFolder,
  newFolderName,
  onNewFolderNameChange,
  onStartCreateFolder,
  onCancelCreateFolder,
  onSubmitCreateFolder,
  onOpenFolder,
}: {
  folders: ReturnType<typeof useLibraryStore.getState>["folders"];
  isCreatingFolder: boolean;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  onStartCreateFolder: () => void;
  onCancelCreateFolder: () => void;
  onSubmitCreateFolder: (e: React.FormEvent) => void;
  onOpenFolder: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
        <Bookmark className="size-3.5" />
        Minhas Pastas
      </h3>
      <FolderGrid
        folders={folders}
        isCreatingFolder={isCreatingFolder}
        newFolderName={newFolderName}
        onNewFolderNameChange={onNewFolderNameChange}
        onStartCreateFolder={onStartCreateFolder}
        onCancelCreateFolder={onCancelCreateFolder}
        onSubmitCreateFolder={onSubmitCreateFolder}
        onOpenFolder={onOpenFolder}
      />
    </section>
  );
}

function LibrarySections({
  folders,
  setlists,
  recentes,
  isCreatingFolder,
  newFolderName,
  onNewFolderNameChange,
  onStartCreateFolder,
  onCancelCreateFolder,
  onSubmitCreateFolder,
  onOpenFolder,
  onCreateSetlist,
  onOpenSetlist,
  onDeleteSetlist,
  onSelectRecent,
  removeFromRecentes,
  clearAllRecentes,
}: {
  folders: ReturnType<typeof useLibraryStore.getState>["folders"];
  setlists: ReturnType<typeof useLibraryStore.getState>["setlistSummaries"];
  recentes: ReturnType<typeof useLibraryStore.getState>["recentes"];
  isCreatingFolder: boolean;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  onStartCreateFolder: () => void;
  onCancelCreateFolder: () => void;
  onSubmitCreateFolder: (e: React.FormEvent) => void;
  onOpenFolder: (id: string) => void;
  onCreateSetlist: (title: string) => Promise<void>;
  onOpenSetlist: (id: string) => void;
  onDeleteSetlist: (id: string) => Promise<void>;
  onSelectRecent: (song: StoredSong) => void;
  removeFromRecentes: (song: StoredSong) => void;
  clearAllRecentes: () => void;
}) {
  return (
    <>
      <FoldersSection
        folders={folders}
        isCreatingFolder={isCreatingFolder}
        newFolderName={newFolderName}
        onNewFolderNameChange={onNewFolderNameChange}
        onStartCreateFolder={onStartCreateFolder}
        onCancelCreateFolder={onCancelCreateFolder}
        onSubmitCreateFolder={onSubmitCreateFolder}
        onOpenFolder={onOpenFolder}
      />
      <SetlistsHomeSection
        setlists={setlists}
        onCreate={onCreateSetlist}
        onOpen={onOpenSetlist}
        onDelete={onDeleteSetlist}
      />
      <RecentList
        recentes={recentes}
        onSelect={onSelectRecent}
        onRemove={removeFromRecentes}
        onClearAll={clearAllRecentes}
      />
    </>
  );
}

export function HomeView() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { results, isSearching } = useSearchDebounced(searchQuery);

  const folders = useLibraryStore((s) => s.folders);
  const setlists = useLibraryStore((s) => s.setlistSummaries);
  const recentes = useLibraryStore((s) => s.recentes);
  const libraryLoaded = useLibraryStore((s) => s.libraryLoaded);

  const { doCreateFolder, clearAllRecentes, removeFromRecentes } = useLibraryActions();

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const handleStartCreateFolder = () => setIsCreatingFolder(true);
  const handleCancelCreateFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName("");
  };
  const handleSubmitCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    void doCreateFolder(newFolderName).then(() => {
      setNewFolderName("");
      setIsCreatingFolder(false);
    });
  };

  const onOpenFolder = (id: string) => router.push(`/folder/${id}`);
  const onSelectSearchResult = (res: SearchResultSong) => router.push(`/song/${res.artistSlug}/${res.slug}`);
  const onSelectArtistResult = (res: SearchResultArtist) => router.push(`/artist/${res.artistSlug}`);
  const onSelectRecent = (song: StoredSong) => {
    const params = new URLSearchParams({ arrangementId: arrangementKey(song) });
    router.push(`/song/${song.artistSlug}/${song.slug}?${params.toString()}`);
  };

  const onCreateSetlist = async (title: string) => {
    try {
      if (title.trim()) await cloudCreateSetlist(title.trim(), null);
    } catch {}
  };

  const onOpenSetlist = (id: string) => router.push(`/setlist/${id}`);
  const onDeleteSetlist = async (id: string) => {
    try {
      await cloudDeleteSetlist(id);
    } catch {}
  };

  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/30">
      <HomeHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-5 pt-12 pb-24">
        <HomeHero
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          results={results}
          isSearching={isSearching}
          onSelectSearchResult={onSelectSearchResult}
          onSelectArtistResult={onSelectArtistResult}
        />

        {!searchQuery && (
          <div className="flex w-full flex-col gap-12 animate-in fade-in fill-mode-both delay-150 duration-700">
            {!libraryLoaded ? (
              <LibraryLoading />
            ) : (
              <LibrarySections
                folders={folders}
                setlists={setlists}
                recentes={recentes}
                isCreatingFolder={isCreatingFolder}
                newFolderName={newFolderName}
                onNewFolderNameChange={setNewFolderName}
                onStartCreateFolder={handleStartCreateFolder}
                onCancelCreateFolder={handleCancelCreateFolder}
                onSubmitCreateFolder={handleSubmitCreateFolder}
                onOpenFolder={onOpenFolder}
                onCreateSetlist={onCreateSetlist}
                onOpenSetlist={onOpenSetlist}
                onDeleteSetlist={onDeleteSetlist}
                onSelectRecent={onSelectRecent}
                removeFromRecentes={removeFromRecentes}
                clearAllRecentes={clearAllRecentes}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
