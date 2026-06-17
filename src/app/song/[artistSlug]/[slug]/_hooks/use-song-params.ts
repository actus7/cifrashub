import { useParams } from "next/navigation";

export function useSongParams() {
  const params = useParams();
  return {
    artistSlug: Array.isArray(params.artistSlug) ? params.artistSlug[0] : params.artistSlug,
    slug: Array.isArray(params.slug) ? params.slug[0] : params.slug,
  };
}
