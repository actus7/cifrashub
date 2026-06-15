import { NextResponse } from "next/server";
import { extractYoutubeIdFromHtml } from "@/lib/parser";
import { cifraClubHeaders, readCifraSlugParams } from "@/lib/server/cifra-route";

export async function GET(request: Request) {
  const params = readCifraSlugParams(request);
  if ("response" in params) {
    return NextResponse.json(
      { youtubeId: null, error: "Parâmetros inválidos" },
      { status: 400 },
    );
  }

  const pageUrl = `https://www.cifraclub.com.br/${params.artistSlug}/${params.slug}/`;

  try {
    const res = await fetch(pageUrl, {
      headers: cifraClubHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { youtubeId: null, error: `Cifra Club respondeu ${res.status}` },
        { status: 502 },
      );
    }

    const html = await res.text();
    const youtubeId = extractYoutubeIdFromHtml(html) ?? null;

    return NextResponse.json({ youtubeId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao buscar página";
    return NextResponse.json({ youtubeId: null, error: message }, { status: 502 });
  }
}
