import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSetlistItems } from "@/db/schema";
import { requireUserId } from "@/lib/server/api-auth";
import { readJsonBody } from "@/lib/server/api-route";
import { nextPosition } from "@/lib/server/positions";
import {
  assertUserOwnsArrangement,
  assertUserOwnsSetlist,
  getSetlistDetail,
} from "@/lib/server/setlist-queries";

type RouteCtx = { params: Promise<{ id: string }> };

async function requireOwnedSetlist(ctx: RouteCtx) {
  const authResult = await requireUserId();
  if ("error" in authResult) return { error: authResult.error };

  const { id: setlistId } = await ctx.params;
  const ownsSetlist = await assertUserOwnsSetlist(authResult.userId, setlistId);
  if (!ownsSetlist) {
    return {
      error: NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 }),
    };
  }

  return { userId: authResult.userId, setlistId };
}

async function requireOwnedSetlistJson<T>(req: Request, ctx: RouteCtx) {
  const setlist = await requireOwnedSetlist(ctx);
  if ("error" in setlist) return { error: setlist.error };

  const json = await readJsonBody<T>(req);
  if ("response" in json) return { error: json.response };

  return { setlist, body: json.body };
}

export async function POST(req: Request, ctx: RouteCtx) {
  const request = await requireOwnedSetlistJson<{ arrangementId?: string; notes?: string | null }>(req, ctx);
  if ("error" in request) return request.error;

  const arrangementId = await ownedArrangementId(request.setlist.userId, request.body.arrangementId);
  if ("error" in arrangementId) return arrangementId.error;

  await insertSetlistItem(request.setlist.setlistId, arrangementId.value, request.body.notes);
  return setlistDetailResponse(request.setlist.userId, request.setlist.setlistId);
}

async function ownedArrangementId(userId: string, arrangementId: string | undefined) {
  const value = arrangementId?.trim();
  if (!value) return { error: NextResponse.json({ error: "arrangementId obrigatório" }, { status: 400 }) };

  const ok = await assertUserOwnsArrangement(userId, value);
  if (!ok) {
    return {
      error: NextResponse.json(
        { error: "Arranjo não encontrado na sua biblioteca" },
        { status: 400 },
      ),
    };
  }

  return { value };
}

async function insertSetlistItem(setlistId: string, arrangementId: string, notes: string | null | undefined) {
  await db.insert(userSetlistItems).values({
    setlistId,
    arrangementId,
    position: await nextSetlistItemPosition(setlistId),
    notes: notes?.trim() || null,
  });
}

async function nextSetlistItemPosition(setlistId: string) {
  const current = await db
    .select()
    .from(userSetlistItems)
    .where(eq(userSetlistItems.setlistId, setlistId));
  return nextPosition(current);
}

async function setlistDetailResponse(userId: string, setlistId: string) {
  const detail = await getSetlistDetail(userId, setlistId);
  return NextResponse.json(detail);
}

/** Atualiza positions com um único UPDATE ... CASE. */
async function batchUpdatePositions(
  setlistId: string,
  orderedIds: string[],
) {
  if (orderedIds.length === 0) return;
  const cases = orderedIds
    .map((id, i) => sql`when ${id} then ${i}`)
    .reduce((acc, c) => sql`${acc} ${c}`);

  await db
    .update(userSetlistItems)
    .set({
      position: sql`case ${userSetlistItems.id} ${cases} end`,
    })
    .where(
      and(
        eq(userSetlistItems.setlistId, setlistId),
        inArray(userSetlistItems.id, orderedIds),
      ),
    );
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const request = await requireOwnedSetlistJson<{ orderedItemIds?: string[] }>(req, ctx);
  if ("error" in request) return request.error;

  const order = await validItemOrder(request.setlist.setlistId, request.body.orderedItemIds);
  if ("error" in order) return order.error;

  await batchUpdatePositions(request.setlist.setlistId, order.value);
  return setlistDetailResponse(request.setlist.userId, request.setlist.setlistId);
}

async function validItemOrder(setlistId: string, orderedItemIds: string[] | undefined) {
  if (!Array.isArray(orderedItemIds) || !orderedItemIds.every((x) => typeof x === "string")) {
    return { error: NextResponse.json({ error: "orderedItemIds inválido" }, { status: 400 }) };
  }

  const items = await db
    .select()
    .from(userSetlistItems)
    .where(eq(userSetlistItems.setlistId, setlistId));

  return hasExactItemOrder(orderedItemIds, items.map((i) => i.id))
    ? { value: orderedItemIds }
    : {
        error: NextResponse.json(
          { error: "orderedItemIds deve listar todos os itens exatamente uma vez" },
          { status: 400 },
        ),
      };
}

function hasExactItemOrder(order: string[], itemIds: string[]) {
  const idSet = new Set(itemIds);
  return order.length === itemIds.length && order.every((id) => idSet.has(id));
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const setlist = await requireOwnedSetlist(ctx);
  if ("error" in setlist) return setlist.error;

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "itemId obrigatório" }, { status: 400 });
  }

  await db
    .delete(userSetlistItems)
    .where(
      and(
        eq(userSetlistItems.setlistId, setlist.setlistId),
        eq(userSetlistItems.id, itemId),
      ),
    );

  // Recompacta positions em um único UPDATE
  const remaining = await db
    .select({ id: userSetlistItems.id })
    .from(userSetlistItems)
    .where(eq(userSetlistItems.setlistId, setlist.setlistId))
    .orderBy(asc(userSetlistItems.position), asc(userSetlistItems.createdAt));

  await batchUpdatePositions(
    setlist.setlistId,
    remaining.map((r) => r.id),
  );

  return setlistDetailResponse(setlist.userId, setlist.setlistId);
}
