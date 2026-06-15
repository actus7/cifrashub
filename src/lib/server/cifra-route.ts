import { NextResponse } from "next/server";

const SLUG_SEGMENT_RE = /^[a-z0-9-]{1,120}$/i;

export function readCifraSlugParams(request: Request) {
  const { searchParams } = new URL(request.url);
  const artistSlug = searchParams.get("artistSlug")?.trim() ?? "";
  const slug = searchParams.get("slug")?.trim() ?? "";

  if (!SLUG_SEGMENT_RE.test(artistSlug) || !SLUG_SEGMENT_RE.test(slug)) {
    return { response: NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 }) };
  }

  return { artistSlug, slug };
}

export const cifraClubHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};
