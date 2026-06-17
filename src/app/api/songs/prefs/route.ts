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

function validationError(message: string): never {
  throw new Error(message);
}

function validateArrangementId(body: PrefsRequestBody) {
  return body.arrangementId?.trim() || validationError("arrangementId obrigatório");
}

function validateInteger(value: unknown, field: string) {
  return typeof value === "number" && Number.isInteger(value) ? value : validationError(`${field} inválido`);
}

function isNullableObject(value: unknown) {
  return value === null || value === undefined || typeof value === "object";
}

function validateUiPrefs(uiPrefs: unknown) {
  if (!isNullableObject(uiPrefs)) validationError("uiPrefs inválido");
  return uiPrefs ?? null;
}

function buildPrefs(body: PrefsRequestBody): ValidatedPrefs {
  return {
    arrangementId: validateArrangementId(body),
    tone: validateInteger(body.tone ?? 0, "tone"),
    capo: validateInteger(body.capo ?? 0, "capo"),
    uiPrefs: validateUiPrefs(body.uiPrefs),
  };
}

function validatePrefs(body: PrefsRequestBody): ValidatedPrefs | { error: string } {
  try {
    return buildPrefs(body);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "prefs inválido" };
  }
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
