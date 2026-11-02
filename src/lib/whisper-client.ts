import type { SpeechListener } from "@/lib/speech";

/** Tamanho de cada trecho gravado: curto = menos atraso; longo = mais contexto para o Whisper. */
const CHUNK_MS = 3_000;

let availability: Promise<boolean> | null = null;

/** O servidor tem o Whisper configurado? (consultado uma vez por carregamento da página) */
export function whisperAvailable(): Promise<boolean> {
  availability ??= fetch("/api/song/transcribe")
    .then((r) => (r.ok ? r.json() : { available: false }))
    .then((b: { available?: boolean }) => Boolean(b.available))
    .catch(() => false);
  return availability;
}

/**
 * Mesmo contrato do `startSpeech`, mas transcrevendo com o Whisper (servidor): grava trechos de 3 s e manda cada um
 * com a letra perto da posição atual como dica (`getPrompt`). Cada trecho é um arquivo completo (o gravador reinicia),
 * porque pedaços de um mesmo webm não se decodificam sozinhos.
 */
export async function startWhisper(
  { onText, onFinal, onError }: SpeechListener,
  getPrompt: () => string,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
  });
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  let active = true;
  let transcript = "";
  let failures = 0;

  const send = async (blob: Blob) => {
    if (blob.size < 1_000) return;
    const form = new FormData();
    form.set("audio", blob, "trecho.webm");
    form.set("prompt", getPrompt());
    try {
      const res = await fetch("/api/song/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error(String(res.status));
      failures = 0;
      const { text } = (await res.json()) as { text: string };
      if (!active || !text) return;
      transcript = `${transcript} ${text}`.replace(/\s+/g, " ").trim().slice(-2_000);
      onFinal?.(text);
      onText(transcript);
    } catch {
      if (++failures === 3 && active) onError("O transcritor (Whisper) não está respondendo. Tente de novo em instantes.");
    }
  };

  const record = () => {
    if (!active) return;
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => {
      void send(new Blob(parts, { type: rec.mimeType }));
      record();
    };
    rec.start();
    setTimeout(() => rec.state === "recording" && rec.stop(), CHUNK_MS);
  };
  record();

  return () => {
    active = false;
    stream.getTracks().forEach((t) => t.stop());
  };
}
