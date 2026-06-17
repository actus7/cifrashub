import { NextResponse } from "next/server";
import { extractYoutubeIdFromHtml } from "@/lib/extract-youtube-id-from-html";
import { cifraClubHeaders, readCifraSlugParams } from "@/lib/server/cifra-route";

function invalidParamsResponse() {
  return NextResponse.json(
    { youtubeId: null, error: "Parâmetros inválidos" },
    { status: 400 },
  );
}

function cifraClubResponseError(status: number) {
  return NextResponse.json(
    { youtubeId: null, error: `Cifra Club respondeu ${status}` },
    { status: 502 },
  );
}

function fetchErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha ao buscar página";
  return NextResponse.json({ youtubeId: null, error: message }, { status: 502 });
}

async function fetchCifraPage(artistSlug: string, slug: string) {
  const pageUrl = `https://www.cifraclub.com.br/${artistSlug}/${slug}/`;
  return fetch(pageUrl, {
    headers: cifraClubHeaders,
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
}

async function youtubeIdResponse(artistSlug: string, slug: string) {
  try {
    const res = await fetchCifraPage(artistSlug, slug);
    return res.ok ? extractedYoutubeResponse(res) : cifraClubResponseError(res.status);
  } catch (e) {
    return fetchErrorResponse(e);
  }
}

async function extractedYoutubeResponse(res: Response) {
  const youtubeId = extractYoutubeIdFromHtml(await res.text()) ?? null;
  return NextResponse.json({ youtubeId });
}

export async function GET(request: Request) {
  const params = readCifraSlugParams(request);
  return "response" in params
    ? invalidParamsResponse()
    : youtubeIdResponse(params.artistSlug, params.slug);
}
