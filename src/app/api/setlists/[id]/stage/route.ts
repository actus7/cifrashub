import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { setlistStages } from "@/db/schema";
import { resolveSetlistAccess } from "@/lib/server/access";
import { readJsonBody, requireApiUserId } from "@/lib/server/api-route";
import { hasActiveSubscription } from "@/lib/server/entitlement";
import { parseStageUpdate, type StageResponse } from "@/lib/stage";

type RouteCtx = { params: Promise<{ id: string }> };

function notFound() {
  return NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });
}

/** Dono ou membro do setlist lê o estado ao vivo (os músicos consultam a cada ~1 s). */
export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await resolveSetlistAccess(auth.userId, id);
  if (access.role === "none") return notFound();

  const [row] = await db.select().from(setlistStages).where(eq(setlistStages.setlistId, id)).limit(1);
  const body: StageResponse = {
    stage: row
      ? {
          position: row.position,
          lineIndex: row.lineIndex,
          transpose: row.transpose,
          active: row.active,
          updatedAt: row.updatedAt.toISOString(),
        }
      : null,
    viewerRole: access.role,
    ownerName: access.ownerName,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

/** Só o dono do setlist, com assinatura ativa, comanda o palco. */
export async function PUT(req: Request, ctx: RouteCtx) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await resolveSetlistAccess(auth.userId, id);
  if (access.role === "none") return notFound();
  if (access.role !== "owner") {
    return NextResponse.json({ error: "Só o dono do setlist comanda o palco." }, { status: 403 });
  }
  if (!(await hasActiveSubscription(auth.userId))) {
    return NextResponse.json({ error: "Recurso exclusivo para assinantes." }, { status: 403 });
  }

  const json = await readJsonBody<unknown>(req);
  if ("response" in json) return json.response;
  const update = parseStageUpdate(json.body);
  if (!update) return NextResponse.json({ error: "Estado do palco inválido" }, { status: 400 });

  const values = { ...update, updatedAt: new Date() };
  await db
    .insert(setlistStages)
    .values({ setlistId: id, ...values })
    .onConflictDoUpdate({ target: setlistStages.setlistId, set: values });
  return NextResponse.json({ ok: true });
}
