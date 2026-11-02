import { NextResponse } from "next/server";
import { resolveSetlistAccess } from "@/lib/server/access";
import { readJsonBody, requireApiUserId } from "@/lib/server/api-route";
import { hasActiveSubscription } from "@/lib/server/entitlement";
import { askJev } from "@/lib/server/jev";
import { getSetlistDetail } from "@/lib/server/setlist-queries";
import { commandQuestion, toStageCommand } from "@/lib/stage-commands";

type RouteCtx = { params: Promise<{ id: string }> };

const MAX_PHRASE = 300;
/** Uma frase por vez por dono: o cliente já manda só a mais nova. */
const MIN_INTERVAL_MS = 500;
// ponytail: limite em memória por instância; trocar por limite compartilhado se houver abuso.
const lastCallByUser = new Map<string, number>();

/** O dono (assinante) manda uma frase falada; o Jev diz se é um comando do palco. */
export async function POST(req: Request, ctx: RouteCtx) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await resolveSetlistAccess(auth.userId, id);
  if (access.role !== "owner") return NextResponse.json({ error: "Só o dono do setlist comanda o palco." }, { status: 403 });
  if (!(await hasActiveSubscription(auth.userId))) {
    return NextResponse.json({ error: "Recurso exclusivo para assinantes." }, { status: 403 });
  }

  const now = Date.now();
  if (now - (lastCallByUser.get(auth.userId) ?? 0) < MIN_INTERVAL_MS) {
    return NextResponse.json({ error: "Muitas frases seguidas." }, { status: 429 });
  }
  lastCallByUser.set(auth.userId, now);

  const json = await readJsonBody<{ phrase?: unknown }>(req);
  if ("response" in json) return json.response;
  const phrase = typeof json.body.phrase === "string" ? json.body.phrase.trim().slice(-MAX_PHRASE) : "";
  if (phrase.length < 2) return NextResponse.json({ command: null });

  const detail = await getSetlistDetail(auth.userId, id);
  const songs = (detail?.items ?? [])
    .filter((i) => i.song)
    .map((i) => ({ position: i.position, title: i.song!.title, artist: i.song!.artist }));

  try {
    const answers = await askJev(
      { frase: phrase, musicas: songs.map((s) => `${s.title} — ${s.artist}`) },
      { comando: commandQuestion(songs) },
    );
    const a = answers.comando;
    const probability = a?.probabilities?.[a.choice] ?? 0;
    return NextResponse.json({ command: a ? toStageCommand(a.choice, probability) : null, choice: a?.choice, probability });
  } catch (error) {
    console.error("[stage/command] Jev failed:", error);
    return NextResponse.json({ error: "O piloto da IA não respondeu." }, { status: 502 });
  }
}
