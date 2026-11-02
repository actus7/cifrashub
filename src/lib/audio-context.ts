/** Nível de microfone (0–1) acima do qual há som de verdade (abaixo é silêncio/ruído da sala). */
export const SOUND_LEVEL = 0.08;

/** Fábrica cross-browser de AudioContext. */
export function createAudioContext(): AudioContext | null {
  const Win = window as Window & {
    AudioContext?: typeof globalThis.AudioContext;
    webkitAudioContext?: typeof globalThis.AudioContext;
  };
  const Ctor = Win.AudioContext ?? Win.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/** Garante que o contexto está ativo (resume se suspenso). */
export function ensureResumed(ctx: AudioContext): void {
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}
