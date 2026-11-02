import { isMinorKey, keyRoot, NOTES, transposeRootNote } from "@/lib/music";
import type { Section } from "@/lib/types";

/**
 * Detecção do tom tocado/cantado, no método usado em recuperação de informação musical:
 * 1. cromagrama — a energia dos picos do espectro (FFT) somada por classe de altura (12 notas), funciona com
 *    acordes, voz e banda; compensa a afinação (cents fora do Lá 440) para a nota não cair na vizinha;
 * 2. a média do cromagrama ao longo do tempo é comparada com o "molde" da própria música (notas dos acordes da
 *    cifra + perfil de escala do tom escrito) em 12 transposições; vence a que mais se parece.
 */

/** Faixa analisada: abaixo de ~100 Hz a FFT não separa semitons; acima de 2 kHz quase só há harmônicos. */
const MIN_FREQ = 100;
const MAX_FREQ = 2000;
/** Picos mais fracos que isso (em dB abaixo do maior) são ruído. */
const PEAK_RANGE_DB = 45;
const SILENCE_DB = -85;

// Perfis de Krumhansl-Kessler (peso de cada grau a partir da tônica).
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const pc = (n: number) => ((n % 12) + 12) % 12;

function noteIndex(name: string): number {
  return NOTES.indexOf(transposeRootNote(name, 0) as (typeof NOTES)[number]);
}

/** Intervalos (semitons a partir da raiz) de cada qualidade de acorde. */
function chordIntervals(quality: string): number[] {
  const q = quality.toLowerCase();
  let base: number[];
  if (/^(dim|°|º)/.test(q)) base = [0, 3, 6];
  else if (/^(aug|\+)/.test(q)) base = [0, 4, 8];
  else if (/^sus2/.test(q)) base = [0, 2, 7];
  else if (/^sus/.test(q)) base = [0, 5, 7];
  else if (/^m(?!aj)/.test(quality)) base = [0, 3, 7];
  else base = [0, 4, 7];
  if (/7m|maj7|7\+/.test(q)) return [...base, 11];
  if (/7/.test(q)) return [...base, 10];
  return base;
}

/** Classes de altura (0 = C) das notas de um acorde, raiz primeiro; o baixo de "G/B" entra no fim. [] se não for acorde. */
export function chordPitchClasses(chord: string): number[] {
  const m = chord.trim().match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?/);
  if (!m) return [];
  const root = noteIndex(m[1]);
  if (root < 0) return [];
  const notes = chordIntervals(m[2]).map((i) => pc(root + i));
  const bass = m[3] ? noteIndex(m[3]) : -1;
  if (bass >= 0 && !notes.includes(bass)) notes.push(bass);
  return notes;
}

function normalize(v: number[]): number[] {
  const sum = v.reduce((s, x) => s + x, 0);
  return sum > 0 ? v.map((x) => x / sum) : v;
}

/** Molde do tom escrito: notas dos acordes da cifra (por frequência de uso) + perfil da escala do tom escrito. */
export function keyTemplate(songData: Section[], writtenKey: string | undefined): number[] {
  const chords = new Array<number>(12).fill(0);
  for (const section of songData) {
    for (const line of section.content) {
      for (const block of line) {
        if (!block.chord || block.isTab) continue;
        chordPitchClasses(block.chord).forEach((n, i) => (chords[n] += i === 0 ? 1.5 : 1));
      }
    }
  }
  const scale = new Array<number>(12).fill(0);
  const root = writtenKey ? noteIndex(keyRoot(writtenKey)) : -1;
  if (root >= 0) {
    const profile = isMinorKey(writtenKey!) ? MINOR_PROFILE : MAJOR_PROFILE;
    profile.forEach((w, i) => (scale[pc(root + i)] = w));
  }
  const c = normalize(chords);
  const s = normalize(scale);
  return c.map((x, i) => 0.65 * x + 0.35 * s[i]);
}

/**
 * Cromagrama de um quadro de FFT (`magDb` = getFloatFrequencyData) e a afinação estimada nele.
 * `tuningCents` desloca a grade de notas (ex.: -30 para um violão 30 cents abaixo do Lá 440).
 */
export function spectrumChroma(
  magDb: Float32Array,
  sampleRate: number,
  fftSize: number,
  tuningCents: number,
): { chroma: number[]; tuningCents: number; energy: number } {
  const chroma = new Array<number>(12).fill(0);
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor(MIN_FREQ / binHz));
  const hi = Math.min(magDb.length - 2, Math.ceil(MAX_FREQ / binHz));
  let maxDb = -Infinity;
  for (let i = lo; i <= hi; i++) if (magDb[i] > maxDb) maxDb = magDb[i];
  if (maxDb < SILENCE_DB) return { chroma, tuningCents, energy: 0 };

  let energy = 0;
  let sinSum = 0;
  let cosSum = 0;
  for (let i = lo; i <= hi; i++) {
    const db = magDb[i];
    if (db < maxDb - PEAK_RANGE_DB || db < magDb[i - 1] || db < magDb[i + 1]) continue;
    // Interpolação parabólica: frequência do pico entre bins.
    const a = magDb[i - 1];
    const c = magDb[i + 1];
    const denom = a - 2 * db + c;
    const offset = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
    const freq = (i + offset) * binHz;
    const weight = 10 ** (db / 20);
    const semis = 12 * Math.log2(freq / 440) - tuningCents / 100;
    const nearest = Math.round(semis);
    chroma[pc(nearest + 9)] += weight;
    energy += weight;
    // Desvio em relação à grade, para estimar a afinação (média circular).
    const angle = 2 * Math.PI * (semis - nearest);
    sinSum += weight * Math.sin(angle);
    cosSum += weight * Math.cos(angle);
  }
  const deviation = energy > 0 ? (Math.atan2(sinSum, cosSum) / (2 * Math.PI)) * 100 : 0;
  return { chroma, tuningCents: tuningCents + deviation, energy };
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
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

/**
 * Transposição (-5..+6) do molde que mais se parece com o cromagrama médio.
 * `confidence` = vantagem da melhor sobre a segunda (0 = indeciso).
 */
export function bestShift(chroma: number[], template: number[]): { shift: number; confidence: number } {
  const scores = Array.from({ length: 12 }, (_, t) =>
    correlation(chroma, template.map((_, i) => template[pc(i - t)])),
  );
  const order = scores.map((s, t) => [s, t]).sort((x, y) => y[0] - x[0]);
  const [best, second] = order;
  const raw = best[1];
  return { shift: raw > 6 ? raw - 12 : raw, confidence: Math.max(0, best[0] - second[0]) };
}
