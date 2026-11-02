import { isMinorKey, keyRoot, NOTES, transposeRootNote } from "@/lib/music";

/** Faixa de voz/instrumento considerada (Hz). */
const MIN_FREQ = 70;
const MAX_FREQ = 1000;
/** Abaixo disso o quadro é tratado como silêncio. */
const MIN_RMS = 0.01;
/** Correlação normalizada mínima para aceitar a altura (evita ruído). */
const MIN_CLARITY = 0.8;

// Perfis de Krumhansl-Kessler (peso de cada grau da escala a partir da tônica).
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Altura fundamental (Hz) de um quadro de áudio por autocorrelação; null se silêncio ou sem altura clara. */
export function pitchFromFrame(buf: Float32Array, sampleRate: number): number | null {
  let energy = 0;
  for (let i = 0; i < buf.length; i++) energy += buf[i] * buf[i];
  if (Math.sqrt(energy / buf.length) < MIN_RMS) return null;

  const minLag = Math.floor(sampleRate / MAX_FREQ);
  const maxLag = Math.min(Math.floor(sampleRate / MIN_FREQ), buf.length - 1);
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i + lag < buf.length; i++) {
      sum += buf[i] * buf[i + lag];
      normA += buf[i] * buf[i];
      normB += buf[i + lag] * buf[i + lag];
    }
    const corr = sum / Math.sqrt(normA * normB || 1);
    // Primeiro pico forte vence: evita escolher um múltiplo do período (oitava abaixo).
    if (corr > bestCorr + 0.01) {
      bestCorr = corr;
      bestLag = lag;
    } else if (bestCorr >= MIN_CLARITY && corr < bestCorr - 0.1) {
      break;
    }
  }
  if (bestLag < 0 || bestCorr < MIN_CLARITY) return null;
  return sampleRate / bestLag;
}

/** Classe de altura (0 = C … 11 = B) de uma frequência. */
export function pitchClass(freq: number): number {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  return ((midi % 12) + 12) % 12;
}

export function pitchClassHistogram(freqs: number[]): number[] {
  const hist = new Array<number>(12).fill(0);
  for (const f of freqs) hist[pitchClass(f)]++;
  return hist;
}

function correlation(a: number[], b: number[]): number {
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db || 1);
}

/** Tônica (0–11) mais provável no modo dado, pelo método de Krumhansl-Schmuckler. */
export function estimateTonic(hist: number[], minor: boolean): number {
  const profile = minor ? MINOR_PROFILE : MAJOR_PROFILE;
  let best = 0;
  let bestScore = -Infinity;
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = hist.map((_, i) => hist[(i + tonic) % 12]);
    const score = correlation(rotated, profile);
    if (score > bestScore) {
      bestScore = score;
      best = tonic;
    }
  }
  return best;
}

/** Semitons (-5..+6) para levar a cifra do tom escrito à tônica detectada. */
export function toneShift(writtenKey: string, detectedTonic: number): number | null {
  // transposeRootNote(…, 0) normaliza bemóis (Bb → A#).
  const root = transposeRootNote(keyRoot(writtenKey), 0);
  const index = NOTES.indexOf(root as (typeof NOTES)[number]);
  if (index === -1) return null;
  const diff = (((detectedTonic - index) % 12) + 12) % 12;
  return diff > 6 ? diff - 12 : diff;
}

/** Ajuste de tom a partir das alturas coletadas; null se não houver dados suficientes. */
export function detectToneShift(freqs: number[], writtenKey: string, minSamples = 20): number | null {
  if (freqs.length < minSamples) return null;
  const tonic = estimateTonic(pitchClassHistogram(freqs), isMinorKey(writtenKey));
  return toneShift(writtenKey, tonic);
}
