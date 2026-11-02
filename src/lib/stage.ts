/** Estado ao vivo do modo palco (setlist_stage), igual no cliente e no servidor. */
export type StageState = {
  position: number;
  lineIndex: number;
  transpose: number;
  active: boolean;
  updatedAt: string;
};

export type StageResponse = {
  stage: StageState | null;
  viewerRole: "owner" | "member";
  ownerName: string | null;
};

export type StageUpdate = Pick<StageState, "position" | "lineIndex" | "transpose" | "active">;

const LIMITS = { position: [0, 10_000], lineIndex: [-1, 10_000], transpose: [-11, 11] } as const;

function intIn(value: unknown, [min, max]: readonly [number, number]): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** Valida o corpo do PUT; null se algum campo vier fora do formato. */
export function parseStageUpdate(body: unknown): StageUpdate | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const position = intIn(b.position, LIMITS.position);
  const lineIndex = intIn(b.lineIndex, LIMITS.lineIndex);
  const transpose = intIn(b.transpose, LIMITS.transpose);
  if (position === null || lineIndex === null || transpose === null || typeof b.active !== "boolean") return null;
  return { position, lineIndex, transpose, active: b.active };
}
