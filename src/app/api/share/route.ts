import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { shareSnapshots, shareTokens, userSongs } from "@/db/schema";
import { requireUserId } from "@/lib/server/api-auth";
import { requireApiUserJson } from "@/lib/server/api-route";
import { rowToStoredSong } from "@/lib/server/cloud-data";
import { getSetlistDetail } from "@/lib/server/setlist-queries";
import type { ShareSnapshotPayload } from "@/lib/share-payload";

type ShareRequestBody = {
  resourceType?: string;
  arrangementId?: string;
  setlistId?: string;
};

const MAX_SHARE_SETLIST_ITEMS = 50;
const MAX_SHARES_PER_HOUR = 30;

export async function POST(req: Request) {
  const request = await requireApiUserJson<ShareRequestBody>(req);
  if ("response" in request) return request.response;

  const limitResponse = await shareRateLimitResponse(request.userId);
  if (limitResponse) return limitResponse;

  const payloadResult = await buildSharePayload(request.userId, request.body);
  if ("response" in payloadResult) return payloadResult.response;

  const [snapshot] = await db
    .insert(shareSnapshots)
    .values({
      resourceType: payloadResult.resourceType,
      payload: payloadResult.payload,
      createdByUserId: request.userId,
    })
    .returning();

  const [tokenRow] = await db
    .insert(shareTokens)
    .values({
      snapshotId: snapshot!.id,
      permission: "read",
    })
    .returning();

  return NextResponse.json({
    token: tokenRow!.token,
    snapshotId: snapshot!.id,
  });
}

async function shareRateLimitResponse(userId: string) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentShares = await db
    .select({ id: shareSnapshots.id })
    .from(shareSnapshots)
    .where(
      and(
        eq(shareSnapshots.createdByUserId, userId),
        gt(shareSnapshots.createdAt, oneHourAgo),
      ),
    );

  if (recentShares.length < MAX_SHARES_PER_HOUR) return null;

  return NextResponse.json(
    { error: "Limite de compartilhamentos por hora atingido. Tente novamente mais tarde." },
    { status: 429 },
  );
}

async function buildSharePayload(userId: string, body: ShareRequestBody) {
  if (body.resourceType === "arrangement") {
    return arrangementSharePayload(userId, body.arrangementId);
  }

  if (body.resourceType === "setlist") {
    return setlistSharePayload(userId, body.setlistId);
  }

  return { response: NextResponse.json({ error: "resourceType inválido" }, { status: 400 }) };
}

async function arrangementSharePayload(userId: string, arrangementId: string | undefined) {
  const aid = arrangementId?.trim();
  if (!aid) return shareError("arrangementId obrigatório", 400);

  const row = preferredArrangementRow(await arrangementRows(userId, aid));
  if (!row) return shareError("Cifra não encontrada", 404);

  return arrangementPayload(row);
}

function shareError(error: string, status: number) {
  return { response: NextResponse.json({ error }, { status }) };
}

function arrangementRows(userId: string, aid: string) {
  return db
    .select()
    .from(userSongs)
    .where(and(eq(userSongs.userId, userId), eq(userSongs.arrangementId, aid)));
}

function preferredArrangementRow(rows: Array<typeof userSongs.$inferSelect>) {
  return rows.find((row) => row.folderId !== null) ?? rows.find((row) => row.isRecent) ?? rows[0];
}

function arrangementPayload(row: typeof userSongs.$inferSelect) {
  return {
    resourceType: "arrangement" as const,
    payload: { type: "arrangement", song: rowToStoredSong(row) } satisfies ShareSnapshotPayload,
  };
}

async function setlistSharePayload(userId: string, setlistId: string | undefined) {
  const sid = setlistId?.trim();
  if (!sid) {
    return { response: NextResponse.json({ error: "setlistId obrigatório" }, { status: 400 }) };
  }

  const detail = await getSetlistDetail(userId, sid);
  if (!detail) {
    return { response: NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 }) };
  }

  if (detail.items.length > MAX_SHARE_SETLIST_ITEMS) {
    return {
      response: NextResponse.json(
        { error: `Setlist excede o limite de ${MAX_SHARE_SETLIST_ITEMS} itens para compartilhamento.` },
        { status: 400 },
      ),
    };
  }

  return {
    resourceType: "setlist" as const,
    payload: {
      type: "setlist",
      title: detail.title,
      description: detail.description,
      items: detail.items.map((it) => ({
        position: it.position,
        arrangementId: it.arrangementId,
        notes: it.notes,
        song: it.song,
      })),
    } satisfies ShareSnapshotPayload,
  };
}

export async function DELETE(req: Request) {
  const authResult = await requireUserId();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token obrigatório" }, { status: 400 });
  }

  const [st] = await db
    .select({
      token: shareTokens.token,
      snapshotId: shareTokens.snapshotId,
    })
    .from(shareTokens)
    .innerJoin(shareSnapshots, eq(shareSnapshots.id, shareTokens.snapshotId))
    .where(
      and(
        eq(shareTokens.token, token),
        isNull(shareTokens.revokedAt),
        eq(shareSnapshots.createdByUserId, authResult.userId),
      ),
    )
    .limit(1);

  if (!st) {
    return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });
  }

  await db
    .update(shareTokens)
    .set({ revokedAt: new Date() })
    .where(eq(shareTokens.token, token));

  return NextResponse.json({ ok: true });
}
