import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { fetchChordsHtmlFresh, clearChordsHtml, invalidateServerCifraCache } from "@/lib/fetch-proxy";
import { processHtmlAndExtract } from "@/lib/parser";
import { replaceSongByArrangement } from "@/lib/replace-song-by-arrangement";
import { cloudAddSongToFolder, cloudSaveRecentes, saveFolders, saveRecentes } from "@/lib/storage";
import type { Section, SongVersion, StoredSong } from "@/lib/types";
import { useLibraryStore } from "@/store/use-library-store";

type UseSongVersionArgs = {
  artistSlug?: string;
  slug?: string;
  currentSong: StoredSong | null;
  setCurrentSong: (updater: (s: StoredSong | null) => StoredSong | null) => void;
  setSongData: (data: Section[]) => void;
  folderId: string | null;
  arrangementId: string | null;
  hasSavedVersion: boolean;
  initialCachedSongDataRef: MutableRefObject<Section[]>;
  savedSongDataRef: MutableRefObject<Section[] | null>;
  onFullReload: () => Promise<void> | void;
};

/**
 * Manages the chord-version state machine (saved ↔ cache ↔ original).
 *
 * Initial rule: "cache" by default; transitions to "saved" once
 * `hasSavedVersion` becomes true after the first load completes.
 * Resets on song-identity change (artistSlug/slug).
 */
export function useSongVersion({
  artistSlug,
  slug,
  currentSong,
  setCurrentSong,
  setSongData,
  folderId,
  hasSavedVersion,
  initialCachedSongDataRef,
  savedSongDataRef,
  onFullReload,
}: UseSongVersionArgs) {
  const { status } = useSession();
  const [songVersion, setSongVersionState] = useState<SongVersion>("cache");
  const [versionActionPending, setVersionActionPending] = useState(false);
  const originalSongDataRef = useRef<Section[] | null>(null);
  const userChangedRef = useRef(false);
  const songKey = `${artistSlug ?? ""}/${slug ?? ""}`;
  const prevSongKeyRef = useRef(songKey);

  // Reset version when navigating to a different song.
  useEffect(() => {
    if (prevSongKeyRef.current !== songKey) {
      prevSongKeyRef.current = songKey;
      userChangedRef.current = false;
      originalSongDataRef.current = null;
      setSongVersionState("cache");
    }
  }, [songKey]);

  // Auto-upgrade to "saved" when a saved arrangement is discovered on first load.
  useEffect(() => {
    if (hasSavedVersion && !userChangedRef.current && songVersion === "cache") {
      setSongVersionState("saved");
    }
  }, [hasSavedVersion, songVersion]);

  // Declared before setSongVersion so it can be referenced there.
  const onReloadOriginal = useCallback(async () => {
    if (!artistSlug || !slug || versionActionPending) return;
    setVersionActionPending(true);
    try {
      const html = await fetchChordsHtmlFresh(artistSlug, slug);
      const parsed = processHtmlAndExtract(html, `${artistSlug}-${slug}`, "", "", artistSlug, slug);
      originalSongDataRef.current = parsed.songData;
      setSongData(parsed.songData);
      userChangedRef.current = true;
      setSongVersionState("original");
    } catch {
      toast.error("Não foi possível carregar a cifra original.");
    } finally {
      setVersionActionPending(false);
    }
  }, [artistSlug, slug, setSongData, versionActionPending]);

  const setSongVersion = useCallback(
    (version: SongVersion) => {
      userChangedRef.current = true;

      if (version === "cache") {
        const cached = initialCachedSongDataRef.current;
        if (cached.length > 0) {
          setSongData(cached);
        } else {
          void onFullReload();
        }
        setSongVersionState("cache");
        return;
      }

      if (version === "saved") {
        const saved = savedSongDataRef.current;
        if (saved) {
          setSongData(saved);
          setSongVersionState("saved");
        }
        // else no-op — no saved content available
        return;
      }

      if (version === "original") {
        void onReloadOriginal();
      }
    },
    [initialCachedSongDataRef, savedSongDataRef, setSongData, onFullReload, onReloadOriginal],
  );

  const onResetSaved = useCallback(async () => {
    if (!hasSavedVersion || !currentSong || !artistSlug || !slug || versionActionPending) return;
    setVersionActionPending(true);
    try {
      // Reuse cached original parse if available, otherwise fetch fresh.
      let originData = originalSongDataRef.current;
      if (!originData) {
        const html = await fetchChordsHtmlFresh(artistSlug, slug);
        const parsed = processHtmlAndExtract(html, `${artistSlug}-${slug}`, "", "", artistSlug, slug);
        originData = parsed.songData;
        originalSongDataRef.current = originData;
      }

      const editedSong: StoredSong = { ...currentSong, songData: originData };
      setCurrentSong((prev) => (prev ? { ...prev, songData: originData } : prev));
      setSongData(originData);
      savedSongDataRef.current = originData;
      userChangedRef.current = true;
      setSongVersionState("saved");
      toast.success("Versão salva restaurada à origem.");

      // Fire-and-forget persistence (same paths as use-apply-edit-result).
      void persistEditedContent(status, folderId, editedSong).catch((error) => {
        console.error("Failed to persist reset song content", error);
      });
    } catch {
      toast.error("Não foi possível restaurar a versão salva.");
    } finally {
      setVersionActionPending(false);
    }
  }, [hasSavedVersion, currentSong, artistSlug, slug, setCurrentSong, setSongData, status, folderId, savedSongDataRef, versionActionPending]);

  const onResetCache = useCallback(async () => {
    if (!artistSlug || !slug || versionActionPending) return;
    setVersionActionPending(true);
    try {
      await invalidateServerCifraCache(artistSlug, slug);
      clearChordsHtml(artistSlug, slug);
      // Não usar o GET padrão aqui: a resposta é cacheada pela CDN
      // (s-maxage) e devolveria HTML antigo mesmo após limpar o banco.
      // `source=fresh` busca direto da fonte e renova o cache do servidor.
      const html = await fetchChordsHtmlFresh(artistSlug, slug);
      const parsed = processHtmlAndExtract(html, `${artistSlug}-${slug}`, "", "", artistSlug, slug);
      originalSongDataRef.current = parsed.songData;
      initialCachedSongDataRef.current = parsed.songData;

      const saved = savedSongDataRef.current;
      userChangedRef.current = false;
      if (saved) {
        setSongData(saved);
        setSongVersionState("saved");
      } else {
        setSongData(parsed.songData);
        setSongVersionState("cache");
      }
      toast.success("Cache da cifra limpo e atualizado.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao limpar cache do servidor";
      toast.error(message);
    } finally {
      setVersionActionPending(false);
    }
  }, [artistSlug, slug, setSongData, savedSongDataRef, initialCachedSongDataRef, versionActionPending]);

  return {
    songVersion,
    setSongVersion,
    onReloadOriginal,
    onResetSaved,
    onResetCache,
    versionActionPending,
    hasSavedVersion,
  };
}

// ── Persistence helpers (mirror use-apply-edit-result.ts paths) ──────────────

async function persistEditedContent(
  status: "loading" | "authenticated" | "unauthenticated",
  folderId: string | null,
  song: StoredSong,
) {
  if (status === "authenticated") {
    await persistEditedContentCloud(folderId, song);
  } else {
    persistEditedContentLocal(folderId, song);
  }
}

async function persistEditedContentCloud(folderId: string | null, song: StoredSong) {
  if (folderId) {
    const { folders } = await cloudAddSongToFolder(folderId, song);
    useLibraryStore.getState().setFolders(folders);
    return;
  }
  const { recentes, setRecentes } = useLibraryStore.getState();
  const nextRecentes = replaceSongByArrangement(recentes, song).slice(0, 15);
  const { recentes: synced } = await cloudSaveRecentes(nextRecentes);
  setRecentes(synced);
}

function persistEditedContentLocal(folderId: string | null, song: StoredSong) {
  if (folderId) {
    const { folders, setFolders } = useLibraryStore.getState();
    const nextFolders = folders.map((folder) =>
      folder.id !== folderId
        ? folder
        : { ...folder, songs: replaceSongByArrangement(folder.songs, song) },
    );
    saveFolders(nextFolders);
    setFolders(nextFolders);
    return;
  }
  const { recentes, setRecentes } = useLibraryStore.getState();
  const nextRecentes = replaceSongByArrangement(recentes, song).slice(0, 15);
  saveRecentes(nextRecentes);
  setRecentes(nextRecentes);
}
