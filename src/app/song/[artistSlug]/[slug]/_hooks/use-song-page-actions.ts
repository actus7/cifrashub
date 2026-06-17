import { useRouter } from "next/navigation";
import { arrangementKey } from "@/lib/arrangement-key";
import { writeEditSnapshot } from "@/lib/cifras-edit-bridge";
import type { Section, StoredSong } from "@/lib/types";
import { usePlayerStore } from "@/store/use-player-store";
import { usePlayerContextState } from "./use-player-context-state";

export function useSongPageActions(
  currentSong: StoredSong | null,
  songData: Section[],
  setCurrentSong: (updater: (song: StoredSong | null) => StoredSong | null) => void,
  folderId: string | null,
  arrangementId: string | null,
) {
  const router = useRouter();
  const player = usePlayerContextState();

  return {
    player,
    onYoutubeVideoResolved: (youtubeId: string) => setCurrentSong((prev) => prev ? { ...prev, youtubeId } : prev),
    onBack: () => router.back(),
    onOpenVideo: () => player.setYoutubeMiniOpen(true),
    onOpenArtistSongs: () => {
      if (currentSong) router.push(`/artist/${currentSong.artistSlug}`);
    },
    onPrint: () => window.print(),
    onTapZone: () => {},
    onToggleZen: () => player.setZenMode(!usePlayerStore.getState().zenMode),
    onOpenSongEditor: () => {
      if (!currentSong) return;
      const ps = usePlayerStore.getState();
      writeEditSnapshot({
        v: 1,
        currentSong,
        songData,
        origin: {
          artistSlug: currentSong.artistSlug,
          slug: currentSong.slug,
          folderId,
          arrangementId: arrangementId ?? arrangementKey(currentSong),
        },
        display: {
          tone: ps.tone,
          capo: ps.capo,
          simplified: ps.simplified,
          showTabs: ps.showTabs,
          mirrored: ps.mirrored,
          fontSizeOffset: ps.fontSizeOffset,
          columns: ps.columns,
          spacingOffset: ps.spacingOffset,
        },
      });
      router.push("/editar");
    },
    onShareArrangement: () => {
      if (typeof window !== "undefined" && navigator?.clipboard) {
        void navigator.clipboard.writeText(window.location.href);
      }
    },
  };
}
