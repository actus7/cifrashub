"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArtistView } from "@/components/artist/artist-view";
import { navigateBackOrFallback } from "@/lib/navigation";
import type { SearchResultSong } from "@/lib/types";

export default function ArtistPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const artistSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const artistNameFromQuery = searchParams.get("name") || artistSlug || ""; // Simplistic fallback

  const handleOpenSong = (song: SearchResultSong) => {
    router.push(`/song/${song.artistSlug}/${song.slug}`);
  };

  return (
    <ArtistView
      artistName={artistNameFromQuery}
      artistSlug={artistSlug as string}
      onBack={() => navigateBackOrFallback(router)}
      onOpenSong={handleOpenSong}
    />
  );
}
