import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSongs } from "@/db/schema";
import { requireApiUserJson } from "@/lib/server/api-route";
import type { StoredSongUiPrefs } from "@/lib/types";

type PrefsRequestBody = {
  arrangementId?: string;
  tone?: unknown;
  capo?: unknown;
  uiPrefs?: StoredSongUiPrefs | null;
};

type ValidatedPrefs = {
  arrangementId: string;
  tone: number;
  capo: number;
  uiPrefs: StoredSongUiPrefs | null;
};

function validatePrefs(body: PrefsRequestBody): ValidatedPrefs | { error: string } {
  const arrangementId = body.arrangementId?.trim();
  if (!arrangementId) return { error: "arrangementId obrigatório" };
  const tone = body.tone ?? 0;
  const capo = body.capo ?? 0;
  if (typeof tone !== "number" || !Number.isInteger(tone)) return { error: "tone inválido" };
  if (typeof capo !== "number" || !Number.isInteger(capo)) return { error: "capo inválido" };
  if (body.uiPrefs !== null && body.uiPrefs !== undefined && typeof body.uiPrefs !== "object") return { error: "uiPrefs inválido" };

  return {
    arrangementId,
    tone,
    capo,
    uiPrefs: body.uiPrefs ?? null,
  };
}

export async function PATCH(req: Request) {
  const request = await requireApiUserJson<PrefsRequestBody>(req);
  if ("response" in request) return request.response;

  const prefs = validatePrefs(request.body);
  if ("error" in prefs) {
    return NextResponse.json({ error: prefs.error }, { status: 400 });
  }

  const updated = await db
    .update(userSongs)
    .set({
      tone: prefs.tone,
      capo: prefs.capo,
      uiPrefs: prefs.uiPrefs,
      updatedAt: new Date(),
    })
    .where(and(eq(userSongs.userId, request.userId), eq(userSongs.arrangementId, prefs.arrangementId)))
    .returning({ id: userSongs.id });

  return NextResponse.json({ ok: true, updated: updated.length });
}
