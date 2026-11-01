import type { StoredSong, StoredSongUiPrefs } from "@/lib/types";
import { UI_PREF_KEYS } from "@/lib/server/stored-song-row";

export const MAX_TITLE = 300;
export const MAX_SLUG = 200;
export const MAX_SECTIONS = 200;
export const MAX_LINES_PER_SECTION = 500;
export const MAX_SONGDATA_BYTES = 512 * 1024;
export const MAX_SYNC_FOLDERS = 200;
export const MAX_SONGS_PER_FOLDER = 2000;

type Result = { ok: true; song: StoredSong } | { ok: false; error: string };

const NUMERIC_RANGES: Partial<Record<keyof StoredSongUiPrefs, readonly [number, number]>> = {
  bpm: [20, 300],
  fontSizeOffset: [-8, 24],
  spacingOffset: [-8, 32],
  columns: [1, 6],
  scrollSpeed: [1, 5],
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function boundedString(v: unknown, field: string, max: number): string | null {
  if (typeof v !== "string" || v.trim() === "") return `${field} inválido`;
  return v.length > max ? `${field} excede ${max} caracteres` : null;
}

function validateBlock(b: unknown): boolean {
  return isRecord(b) && typeof b.chord === "string" && typeof b.text === "string";
}

function validateSongData(data: unknown): string | null {
  if (!Array.isArray(data)) return "songData inválido";
  if (data.length > MAX_SECTIONS) return `songData excede ${MAX_SECTIONS} seções`;
  for (const section of data) {
    if (!isRecord(section) || !Array.isArray(section.content)) return "songData inválido";
    if (section.content.length > MAX_LINES_PER_SECTION) {
      return `seção excede ${MAX_LINES_PER_SECTION} linhas`;
    }
    for (const line of section.content) {
      if (!Array.isArray(line) || !line.every(validateBlock)) return "songData inválido";
    }
  }
  return JSON.stringify(data).length > MAX_SONGDATA_BYTES ? "songData grande demais" : null;
}

function validateIntInRange(v: unknown, field: string, min: number, max: number): string | null {
  if (v === undefined) return null;
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
    ? null
    : `${field} inválido`;
}

export function validateStoredSong(value: unknown): Result {
  if (!isRecord(value)) return { ok: false, error: "Dados da música inválidos" };
  const error =
    boundedString(value.id, "id", MAX_SLUG) ??
    boundedString(value.title, "title", MAX_TITLE) ??
    boundedString(value.artist, "artist", MAX_TITLE) ??
    boundedString(value.artistSlug, "artistSlug", MAX_SLUG) ??
    boundedString(value.slug, "slug", MAX_SLUG) ??
    validateSongData(value.songData) ??
    validateIntInRange(value.tone, "tone", -24, 24) ??
    validateIntInRange(value.capo, "capo", 0, 12);
  return error ? { ok: false, error } : { ok: true, song: value as unknown as StoredSong };
}

/** Só chaves conhecidas; números limitados ao range dos controles da UI. */
export function sanitizeUiPrefs(value: unknown): StoredSongUiPrefs | null {
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = {};
  for (const key of UI_PREF_KEYS) {
    const v = value[key];
    const range = NUMERIC_RANGES[key];
    if (range) {
      if (typeof v === "number" && Number.isFinite(v)) {
        out[key] = Math.min(range[1], Math.max(range[0], v));
      }
    } else if (typeof v === "boolean") {
      out[key] = v;
    }
  }
  return out as StoredSongUiPrefs;
}
