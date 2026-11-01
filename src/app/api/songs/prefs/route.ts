import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSongs } from "@/db/schema";
import { requireApiUserJson } from "@/lib/server/api-route";
import { buildStoredSongRow, toneCapoUiFromStored } from "@/lib/server/stored-song-row";
import { prefsUpdateSet, type ValidatedPrefs } from "@/lib/server/prefs-update";
import { sanitizeUiPrefs, validateStoredSong } from "@/lib/server/song-validation";
import type { StoredSong, StoredSongUiPrefs } from "@/lib/types";

type PrefsRequestBody = {
  arrangementId?: string;
  tone?: unknown;
  capo?: unknown;
  uiPrefs?: StoredSongUiPrefs | null;
  /** Snapshot da música atual — usado só de fallback (ver insertAsRecentIfMissing). */
  song?: StoredSong;
  /** Só quando true o conteúdo (songData) é sobrescrito; prefs puras nunca tocam a cifra. */
  syncContent?: boolean;
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

function validateUiPrefs(uiPrefs: unknown) {
  if (uiPrefs !== null && (typeof uiPrefs !== "object" || Array.isArray(uiPrefs))) {
    validationError("uiPrefs inválido");
  }
  return sanitizeUiPrefs(uiPrefs);
}

function buildPrefs(body: PrefsRequestBody): ValidatedPrefs {
  // Quando tone/capo/uiPrefs não vêm explícitos (chamada de sincronização de
  // conteúdo, não de transposição), derivamos do snapshot da música em vez de
  // resetar para 0/null — evita apagar a personalização já salva.
  const fromSong = body.song ? toneCapoUiFromStored(body.song) : null;
  return {
    arrangementId: validateArrangementId(body),
    tone: body.tone !== undefined ? validateInteger(body.tone, "tone") : (fromSong?.tone ?? 0),
    capo: body.capo !== undefined ? validateInteger(body.capo, "capo") : (fromSong?.capo ?? 0),
    uiPrefs: body.uiPrefs !== undefined ? validateUiPrefs(body.uiPrefs) : (fromSong?.uiPrefs ?? null),
  };
}

function validatePrefs(body: PrefsRequestBody): ValidatedPrefs | { error: string } {
  try {
    return buildPrefs(body);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "prefs inválido" };
  }
}

function isValidSongSnapshot(song: StoredSong | undefined): song is StoredSong {
  return Boolean(song && song.title && song.artist && Array.isArray(song.songData));
}

/**
 * A música pode ainda não existir em nenhuma pasta/recentes do usuário (ex.: acabou de
 * ser aberta, antes do "adicionar aos recentes" completar). Sem este fallback o UPDATE
 * abaixo afeta 0 linhas e a personalização (tom/capo/prefs) some silenciosamente.
 * onConflictDoUpdate cobre a corrida rara de a música ter sido salva em paralelo entre
 * o UPDATE e este INSERT.
 */
async function insertAsRecentIfMissing(userId: string, prefs: ValidatedPrefs, song: StoredSong, syncContent: boolean) {
  const row = {
    ...buildStoredSongRow(userId, null, song, 0, true),
    arrangementId: prefs.arrangementId,
    tone: prefs.tone,
    capo: prefs.capo,
    uiPrefs: prefs.uiPrefs,
  };

  await db
    .insert(userSongs)
    .values(row)
    .onConflictDoUpdate({
      target: [userSongs.userId, userSongs.arrangementId],
      targetWhere: sql`${userSongs.folderId} is null and ${userSongs.isRecent} = true`,
      set: {
        tone: prefs.tone,
        capo: prefs.capo,
        uiPrefs: prefs.uiPrefs,
        ...(syncContent ? { songData: song.songData } : {}),
        updatedAt: new Date(),
      },
    });
}

export async function PATCH(req: Request) {
  const request = await requireApiUserJson<PrefsRequestBody>(req);
  if ("response" in request) return request.response;

  const prefs = validatePrefs(request.body);
  if ("error" in prefs) {
    return NextResponse.json({ error: prefs.error }, { status: 400 });
  }

  // Uma música pode existir em várias linhas (pasta + recentes, ou múltiplas
  // pastas). O UPDATE não filtra por folder_id de propósito: conteúdo editado
  // num placement (ex.: abrindo pelo setlist, sem contexto de pasta) precisa
  // aparecer em todos os outros lugares que referenciam o mesmo arranjo —
  // senão a tela que prioriza a linha de pasta continua mostrando a versão
  // antiga depois de um refresh.
  if (request.body.song != null) {
    const validated = validateStoredSong(request.body.song);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const song = isValidSongSnapshot(request.body.song) ? request.body.song : null;

  const syncContent = request.body.syncContent === true;

  const updated = await db
    .update(userSongs)
    .set(prefsUpdateSet(prefs, song, syncContent, new Date()))
    .where(and(eq(userSongs.userId, request.userId), eq(userSongs.arrangementId, prefs.arrangementId)))
    .returning({ id: userSongs.id });

  if (updated.length === 0 && song) {
    await insertAsRecentIfMissing(request.userId, prefs, song, syncContent);
  }

  return NextResponse.json({ ok: true, updated: updated.length });
}
