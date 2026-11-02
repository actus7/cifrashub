import { chordPitchClasses } from "@/lib/key-detect";

/**
 * Segue a música pelos ACORDES tocados (não depende de reconhecer palavras cantadas).
 *
 * Modelo oculto de Markov sobre as linhas da letra, filtrado a cada quadro de áudio (~100 ms):
 * - emissão: quanto o cromagrama recente se parece com os acordes da linha;
 * - transição: a música anda para a frente — fica na linha ou passa para a próxima (com uma chance pequena de
 *   saltar, para se recuperar de um erro).
 * Duas partes com os mesmos acordes (verso 1 e verso 2) se resolvem pela ordem: a probabilidade vem andando da linha
 * anterior certa.
 */

/** Duração típica de um acorde, em quadros de 100 ms (~2 s). */
const FRAMES_PER_CHORD = 20;
const P_NEXT = 1 / FRAMES_PER_CHORD;
/** Acorde tocado mais curto que o normal: às vezes pula um passo. */
const P_SKIP = P_NEXT * 0.15;
/** Chance, por quadro, de saltar para qualquer outro ponto (recuperação de um erro); bem pequena para não voltar à toa. */
const P_JUMP = 1e-6;
/** Quão "afiada" é a emissão: maior = confia mais em cada quadro. */
const SHARPNESS = 4;

const pc = (n: number) => ((n % 12) + 12) % 12;

/** Cromagrama-molde de um acorde (a raiz pesa mais). */
export function chordTemplate(chord: string, shift: number): number[] {
  const t = new Array<number>(12).fill(0);
  chordPitchClasses(chord).forEach((n, i) => (t[pc(n + shift)] += i === 0 ? 1.5 : 1));
  return t;
}

/** Cromagrama-molde de uma linha: as notas dos acordes dela. */
export function lineChordTemplate(chords: string[], shift: number): number[] {
  const t = new Array<number>(12).fill(0);
  for (const chord of chords) chordTemplate(chord, shift).forEach((x, i) => (t[i] += x));
  return t;
}

/** Linhas sem acorde herdam o último acorde da linha anterior (o acorde continua soando). */
export function fillChordless(lines: string[][]): string[][] {
  let last: string[] = [];
  return lines.map((chords) => {
    if (chords.length > 0) last = chords.slice(-1);
    return chords.length > 0 ? chords : last;
  });
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < 12; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** Um passo da música: um acorde de uma linha. */
type Step = { line: number; template: number[] };

export class ChordFollower {
  private readonly steps: Step[];
  private belief: number[];

  /** `lineChords` = acordes ESCRITOS de cada linha (em ordem); `shift` = semitons até o tom que está soando. */
  constructor(lineChords: string[][], shift: number, startLine = -1) {
    this.steps = fillChordless(lineChords).flatMap((chords, line) =>
      chords.length > 0 ? chords.map((c) => ({ line, template: chordTemplate(c, shift) })) : [{ line, template: [] }],
    );
    const n = this.steps.length;
    const first = startLine >= 0 ? this.steps.findIndex((s) => s.line === startLine) : -1;
    if (first >= 0) {
      this.belief = new Array<number>(n).fill(0);
      this.belief[first] = 1;
    } else {
      // Sem posição: qualquer ponto vale, mas o começo da música é mais provável. Desempata partes com os mesmos
      // acordes (verso 1 × verso 2); uma parte única (o refrão) ainda é achada em poucos quadros.
      const prior = Array.from({ length: n }, (_, i) => 1 / (1 + (4 * i) / Math.max(1, n)));
      const total = prior.reduce((a, b) => a + b, 0);
      this.belief = prior.map((x) => x / total);
    }
  }

  /** Avança um quadro com o cromagrama recente; `null` = silêncio (a posição fica). */
  step(chroma: number[] | null): void {
    const n = this.belief.length;
    if (n === 0 || !chroma) return;
    const moved = new Array<number>(n).fill(P_JUMP / n);
    for (let i = 0; i < n; i++) {
      const b = this.belief[i];
      if (b === 0) continue;
      moved[i] += b * (1 - P_NEXT - P_SKIP);
      // Depois do último acorde a música acabou: essa probabilidade sai (senão o fim "atrairia" a posição).
      if (i + 1 < n) moved[i + 1] += b * P_NEXT;
      if (i + 2 < n) moved[i + 2] += b * P_SKIP;
    }
    for (let i = 0; i < n; i++) {
      const t = this.steps[i].template;
      moved[i] *= Math.exp(SHARPNESS * (t.length ? cosine(chroma, t) : 0.3));
    }
    const total = moved.reduce((s, x) => s + x, 0) || 1;
    this.belief = moved.map((x) => x / total);
  }

  /** Linha mais provável (somando os acordes dela) e sua probabilidade. */
  best(): { index: number; probability: number } {
    const byLine = new Map<number, number>();
    this.steps.forEach((s, i) => byLine.set(s.line, (byLine.get(s.line) ?? 0) + this.belief[i]));
    let index = 0;
    let probability = 0;
    for (const [line, p] of byLine) {
      if (p > probability) {
        index = line;
        probability = p;
      }
    }
    return { index, probability };
  }
}
