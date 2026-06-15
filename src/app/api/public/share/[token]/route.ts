import { NextResponse } from "next/server";
import { fetchSharePayloadByToken } from "@/lib/server/share-query";

type RouteCtx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const tokenTrim = token?.trim();
  if (!tokenTrim) {
    return NextResponse.json({ error: "token inválido" }, { status: 400 });
  }

  const payload = await fetchSharePayloadByToken(tokenTrim);

  if (!payload) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  }

  return NextResponse.json({ payload });
}
