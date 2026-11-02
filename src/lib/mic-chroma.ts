import { createAudioContext, ensureResumed, SOUND_LEVEL } from "@/lib/audio-context";
import { spectrumChroma } from "@/lib/key-detect";

/** FFT grande = resolução de ~3 Hz, suficiente para separar semitons a partir de ~100 Hz. */
const FFT_SIZE = 16_384;
export const FRAME_MS = 100;

export type ChromaFrame = {
  /** Volume (0–1) para o medidor. */
  level: number;
  /** Cromagrama normalizado (soma 1) do quadro; null em silêncio. */
  chroma: number[] | null;
};

function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "O navegador bloqueou o microfone. Libere o acesso no cadeado da barra de endereço.";
  if (name === "NotFoundError") return "Nenhum microfone encontrado.";
  return "Não foi possível ligar o microfone.";
}

/**
 * Liga o microfone e entrega um cromagrama a cada 100 ms (com a afinação compensada aos poucos).
 * Devolve a função que desliga, ou lança Error com mensagem para a pessoa.
 */
export async function startMicChroma(onFrame: (frame: ChromaFrame) => void): Promise<() => void> {
  const ctx = createAudioContext();
  if (!ctx || !navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador não permite usar o microfone.");
  let stream: MediaStream;
  try {
    // Sem processamento de voz: ele corta notas sustentadas de instrumento e distorce o espectro.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    ctx.close().catch(() => {});
    throw new Error(micErrorMessage(err));
  }
  ensureResumed(ctx);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const spectrum = new Float32Array(analyser.frequencyBinCount);
  const wave = new Float32Array(2048);
  let tuning = 0;

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(wave);
    let sum = 0;
    for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
    const level = Math.min(1, Math.sqrt(sum / wave.length) * 6);
    if (level < SOUND_LEVEL) {
      onFrame({ level, chroma: null });
      return;
    }
    analyser.getFloatFrequencyData(spectrum);
    const frame = spectrumChroma(spectrum, ctx.sampleRate, FFT_SIZE, tuning);
    if (frame.energy === 0) {
      onFrame({ level, chroma: null });
      return;
    }
    // A afinação segue a média, devagar (um quadro ruidoso não desloca a grade).
    tuning += (frame.tuningCents - tuning) * 0.05;
    const total = frame.chroma.reduce((s, x) => s + x, 0);
    onFrame({ level, chroma: frame.chroma.map((x) => x / total) });
  }, FRAME_MS);

  return () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };
}
