/**
 * Reconhecimento de voz do navegador (Web Speech, pt-BR, resultados parciais ao vivo).
 * Portado do kit Jev (apps/estudio/public/js/voz.mjs): reinicia sozinho no `onend`, que o Chrome dispara a cada pausa longa.
 */

type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

export function speechRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    "not-allowed": "O navegador bloqueou o microfone. Libere o acesso no cadeado da barra de endereço.",
    "service-not-allowed": "O reconhecimento de voz não está liberado neste navegador. Use o Chrome, o Edge ou o Safari.",
    "audio-capture": "Nenhum microfone encontrado.",
    network: "O reconhecimento de voz do navegador precisa de internet e falhou agora. Tente de novo.",
    "language-not-supported": "O reconhecimento de voz em português não está disponível neste navegador.",
  };
  return messages[error] ?? `O microfone parou (${error}). Tente de novo.`;
}

export type SpeechListener = {
  /** Texto completo reconhecido até agora (finais + parcial atual). */
  onText: (text: string) => void;
  onError: (message: string) => void;
};

/** Liga o reconhecimento contínuo; devolve a função que desliga. null se o navegador não suporta. */
export function startSpeech({ onText, onError }: SpeechListener): (() => void) | null {
  const Ctor = speechRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "pt-BR";
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let previous = "";
  let session = "";
  let active = true;

  rec.onresult = (e) => {
    let finals = "";
    let partial = "";
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finals += r[0].transcript + " ";
      else partial += r[0].transcript;
    }
    session = finals;
    onText(`${previous} ${finals} ${partial}`.replace(/\s+/g, " ").trim());
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    active = false;
    onError(speechErrorMessage(e.error));
  };
  rec.onend = () => {
    previous = `${previous} ${session}`.replace(/\s+/g, " ").trim();
    session = "";
    if (!active) return;
    try {
      rec.start();
    } catch {
      active = false;
    }
  };
  try {
    rec.start();
  } catch {
    return null;
  }
  return () => {
    active = false;
    try {
      rec.stop();
    } catch {
      // já parado
    }
  };
}
