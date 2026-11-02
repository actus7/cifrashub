import { NextResponse } from "next/server";
import { requireApiUserId } from "@/lib/server/api-route";
import { hasActiveSubscription, requireSubscriber } from "@/lib/server/entitlement";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";
/** Trechos de ~3 s em opus ficam bem abaixo disso; acima é abuso ou erro. */
const MAX_AUDIO_BYTES = 1_000_000;
/** O Whisper só usa ~224 tokens de dica; a letra perto da posição atual cabe nisso. */
const MAX_PROMPT_CHARS = 600;
const TIMEOUT_MS = 6_000;

/** O app pergunta se pode usar o Whisper (IA paga): chave configurada e pessoa assinante. Senão, reconhecedor local. */
export async function GET() {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;
  const available = Boolean(process.env.GROQ_API_KEY) && (await hasActiveSubscription(auth.userId));
  return NextResponse.json({ available });
}

/**
 * Transcreve um trecho de canto (assinantes). A letra da música vai como `prompt`: o Whisper usa como contexto e
 * acerta muito mais as palavras cantadas. A chave GROQ_API_KEY fica só no servidor.
 */
export async function POST(req: Request) {
  const auth = await requireSubscriber();
  if ("response" in auth) return auth.response;
  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "Whisper não configurado." }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Áudio inválido." }, { status: 400 });
  }
  const prompt = String(form.get("prompt") ?? "").slice(0, MAX_PROMPT_CHARS);

  const upstream = new FormData();
  upstream.set("file", audio, "trecho.webm");
  upstream.set("model", MODEL);
  upstream.set("language", "pt");
  upstream.set("temperature", "0");
  upstream.set("response_format", "json");
  if (prompt) upstream.set("prompt", prompt);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: upstream,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[transcribe] Groq failed:", res.status, (await res.text()).slice(0, 300));
      return NextResponse.json({ error: "O transcritor não respondeu." }, { status: 502 });
    }
    const body = (await res.json()) as { text?: string };
    return NextResponse.json({ text: (body.text ?? "").trim() });
  } catch (error) {
    console.error("[transcribe] Groq error:", error);
    return NextResponse.json({ error: "O transcritor não respondeu." }, { status: 502 });
  }
}
