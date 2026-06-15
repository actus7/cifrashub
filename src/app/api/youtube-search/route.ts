import { NextResponse } from "next/server";

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
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

function candidateFromItem(item: YtSearchItem): YoutubeCandidate | null {
  const id = item.id?.videoId?.trim();
  if (!id || !YT_ID_RE.test(id)) return null;
  return {
    videoId: id,
    title: (item.snippet?.title ?? "").trim() || "Vídeo",
  };
}

function candidatesFromResponse(data: YtSearchResponse): YoutubeCandidate[] {
  return (data.items ?? []).flatMap((item) => {
    const candidate = candidateFromItem(item);
    return candidate ? [candidate] : [];
  });
}

function successResponse(candidates: YoutubeCandidate[]) {
  const first = candidates[0];
  const body = first
    ? {
        videoId: first.videoId,
        title: first.title,
        candidates,
      }
    : { videoId: null as string | null, error: "no_results" as const };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = sanitizeQ(searchParams.get("q"));
  if (!q) return jsonError("invalid_query", 400);

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    return jsonError("missing_api_key", 503, "YOUTUBE_API_KEY não configurada no servidor.");
  }

  try {
    const res = await fetch(youtubeSearchUrl(q, apiKey).toString(), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(12_000),
    });
    const data = (await res.json()) as YtSearchResponse;
    if (!res.ok) return jsonError("youtube_api", 502, data.error?.message ?? res.statusText);
    return successResponse(candidatesFromResponse(data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na busca";
    return jsonError("network", 502, message);
  }
}
