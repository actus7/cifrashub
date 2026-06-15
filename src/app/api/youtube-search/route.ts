import { NextResponse } from "next/server";
import { isValidYoutubeId } from "@/lib/youtube";

const MAX_Q = 180;
const MIN_Q = 2;

type YtSearchItem = {
  id?: { videoId?: string };
  snippet?: { title?: string };
};

type YtSearchResponse = {
  items?: YtSearchItem[];
  error?: { message?: string };
};

type YoutubeCandidate = { videoId: string; title: string };

function sanitizeQ(raw: string | null): string | null {
  if (raw == null) return null;
  const t = raw.trim().replace(/\s+/g, " ");
  if (t.length < MIN_Q || t.length > MAX_Q) return null;
  return t;
}

function jsonError(error: string, status: number, message?: string) {
  return NextResponse.json(
    { videoId: null as string | null, error, ...(message ? { message } : {}) },
    { status },
  );
}

function youtubeSearchUrl(q: string, apiKey: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("q", q);
  url.searchParams.set("key", apiKey);
  return url;
}

function validVideoId(item: YtSearchItem) {
  const id = item.id?.videoId?.trim();
  return isValidYoutubeId(id) ? id : null;
}

function candidateTitle(item: YtSearchItem) {
  return (item.snippet?.title ?? "").trim() || "Vídeo";
}

function candidateFromItem(item: YtSearchItem): YoutubeCandidate | null {
  const videoId = validVideoId(item);
  return videoId ? { videoId, title: candidateTitle(item) } : null;
}

function candidatesFromResponse(data: YtSearchResponse): YoutubeCandidate[] {
  return (data.items ?? []).flatMap((item) => {
    const candidate = candidateFromItem(item);
    return candidate ? [candidate] : [];
  });
}

function successBody(candidates: YoutubeCandidate[]) {
  const first = candidates[0];
  return first
    ? {
        videoId: first.videoId,
        title: first.title,
        candidates,
      }
    : { videoId: null as string | null, error: "no_results" as const };
}

function successResponse(candidates: YoutubeCandidate[]) {
  return NextResponse.json(successBody(candidates), {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

function youtubeApiKey() {
  return process.env.YOUTUBE_API_KEY?.trim() || null;
}

async function fetchYoutubeSearch(q: string, apiKey: string) {
  const res = await fetch(youtubeSearchUrl(q, apiKey).toString(), {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await res.json()) as YtSearchResponse;
  return { data, res };
}

function networkErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha na busca";
  return jsonError("network", 502, message);
}

async function youtubeSearchResponse(q: string, apiKey: string) {
  try {
    return youtubeSearchResult(await fetchYoutubeSearch(q, apiKey));
  } catch (error) {
    return networkErrorResponse(error);
  }
}

function youtubeSearchResult({ data, res }: Awaited<ReturnType<typeof fetchYoutubeSearch>>) {
  return res.ok
    ? successResponse(candidatesFromResponse(data))
    : jsonError("youtube_api", 502, data.error?.message ?? res.statusText);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = sanitizeQ(searchParams.get("q"));
  if (!q) return jsonError("invalid_query", 400);

  const apiKey = youtubeApiKey();
  if (!apiKey) {
    return jsonError("missing_api_key", 503, "YOUTUBE_API_KEY não configurada no servidor.");
  }

  return youtubeSearchResponse(q, apiKey);
}
