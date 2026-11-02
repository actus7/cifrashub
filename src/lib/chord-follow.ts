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

/** Duração inicial de um acorde, em quadros de 100 ms (~2 s); depois o andamento é aprendido. */
const FRAMES_PER_CHORD = 20;
/** Limites do andamento aprendido (0,6 s a 6 s por acorde). */
const MIN_FRAMES_PER_CHORD = 6;
const MAX_FRAMES_PER_CHORD = 60;
/** Peso de cada nova medição de duração no andamento aprendido. */
const TEMPO_LEARNING = 0.25;
/** Acorde tocado mais curto que o normal: às vezes pula um passo (fração de P_NEXT). */
const SKIP_RATIO = 0.15;
/** Força da evidência das palavras: um trecho que bate 100% com uma linha a torna ~e^4 = 55× mais provável. */
const WORD_SHARPNESS = 4;
/** Chance, por quadro, de saltar para qualquer outro ponto: mínima enquanto o som confirma a posição. */
const P_JUMP = 1e-6;
/**
 * "Recalculando rota", com calibração dinâmica:
 * - ajuste = quanto a posição atual explica o quadro ÷ quanto o melhor ponto da música explicaria (0–1);
 * - a LINHA DE BASE do ajuste é aprendida na sessão (cada microfone/instrumento/sala soa diferente);
 * - perdido = ajuste bem abaixo da base desta sessão, sustentado por ~1,5 s (um acorde mal ouvido não basta);
 * - enquanto perdido, a chance de salto cresce aos poucos (não abre de uma vez).
 */
const FIT_SMOOTHING = 0.1;
/** A base acompanha o ajuste devagar (~10 s), e só enquanto o modelo está seguindo bem. */
const BASELINE_LEARNING = 0.01;
const LOST_RATIO = 0.5;
const RECOVERED_RATIO = 0.8;
/** Quadros seguidos abaixo do limite para se declarar perdido (~1,5 s). */
const LOST_CONFIRM_FRAMES = 15;
/** Crescimento da chance de salto por quadro perdido, até o teto (≈ 3 s para chegar ao máximo). */
const P_JUMP_RAMP = 0.0003;
const P_JUMP_MAX = 0.01;
/**
 * Âncora (adaptação gradual): com a tela firme numa linha e o modelo seguindo bem, hipóteses longe dela
 * enfraquecem aos poucos (3% por quadro → ~metade em 2 s). Não somem de vez: se o som insistir, o modelo fica
 * "perdido" e a âncora se solta.
 */
const ANCHOR_DECAY = 0.97;
const ANCHOR_BACK_LINES = 1;
const ANCHOR_AHEAD_LINES = 2;
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
type Step = { line: number; chord: string; template: number[] };

/**
 * Seguidor por fusão de evidências sobre a mesma crença (posição na música):
 * acordes a cada quadro (`step`), palavras quando o transcritor devolve algo (`observeWords`) e o andamento aprendido
 * (quanto tempo a pessoa fica em cada acorde). Cada fonte cobre a falha da outra.
 */
export class ChordFollower {
  private readonly steps: Step[];
  private belief: number[];
  private framesPerChord = FRAMES_PER_CHORD;
  private bestStep = -1;
  private framesOnBest = 0;
  private fit = 1;
  private baseline = 0.85;
  private belowFrames = 0;
  private lostFrames = 0;
  private lost = false;
  private anchor = -1;

  /** `lineChords` = acordes ESCRITOS de cada linha (em ordem); `shift` = semitons até o tom que está soando. */
  constructor(lineChords: string[][], shift: number, startLine = -1) {
    this.steps = fillChordless(lineChords).flatMap((chords, line) =>
      chords.length > 0
        ? chords.map((chord) => ({ line, chord, template: chordTemplate(chord, shift) }))
        : [{ line, chord: "", template: [] }],
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
    const pNext = 1 / this.framesPerChord;
    const pSkip = pNext * SKIP_RATIO;
    const pJump = this.lost ? Math.min(P_JUMP_MAX, P_JUMP + P_JUMP_RAMP * this.lostFrames) : P_JUMP;
    const moved = new Array<number>(n).fill(pJump / n);
    for (let i = 0; i < n; i++) {
      const b = this.belief[i];
      if (b === 0) continue;
      moved[i] += b * (1 - pNext - pSkip - pJump);
      // Depois do último acorde a música acabou: essa probabilidade sai (senão o fim "atrairia" a posição).
      if (i + 1 < n) moved[i + 1] += b * pNext;
      if (i + 2 < n) moved[i + 2] += b * pSkip;
    }
    let explained = 0;
    let bestEmission = 0;
    for (let i = 0; i < n; i++) {
      const t = this.steps[i].template;
      const emission = Math.exp(SHARPNESS * (t.length ? cosine(chroma, t) : 0.3));
      const prior = moved[i];
      moved[i] *= emission;
      explained += prior * emission;
      bestEmission = Math.max(bestEmission, emission);
    }
    if (this.anchor >= 0 && !this.lost) {
      for (let i = 0; i < n; i++) {
        const line = this.steps[i].line;
        if (line < this.anchor - ANCHOR_BACK_LINES || line > this.anchor + ANCHOR_AHEAD_LINES) moved[i] *= ANCHOR_DECAY;
      }
    }
    const total = moved.reduce((s, x) => s + x, 0) || 1;
    this.belief = moved.map((x) => x / total);
    // Surpresa: quanto da melhor explicação possível a posição atual alcança (1 = confirma; perto de 0 = perdido).
    const priorTotal = explained === 0 ? 0 : explained / bestEmission;
    this.fit += (Math.min(1, priorTotal) - this.fit) * FIT_SMOOTHING;
    this.calibrate();
    this.learnTempo();
  }

  /**
   * Evidência das palavras: `lineScores[i]` (0–1) = quanto o trecho ouvido se parece com a linha i.
   * Multiplica a crença dos acordes dessa linha (regra de Bayes); sem nenhuma linha parecida, não muda nada.
   */
  observeWords(lineScores: number[]): void {
    if (!lineScores.some((x) => x > 0)) return;
    const next = this.belief.map((b, i) => b * Math.exp(WORD_SHARPNESS * (lineScores[this.steps[i].line] ?? 0)));
    const total = next.reduce((s, x) => s + x, 0) || 1;
    this.belief = next.map((x) => x / total);
  }

  /** Calibração dinâmica do "perdido": relativa à base desta sessão e confirmada no tempo. */
  private calibrate(): void {
    if (this.lost) {
      this.lostFrames++;
      if (this.fit > this.baseline * RECOVERED_RATIO) {
        this.lost = false;
        this.lostFrames = 0;
        this.belowFrames = 0;
      }
      return;
    }
    if (this.fit < this.baseline * LOST_RATIO) {
      if (++this.belowFrames >= LOST_CONFIRM_FRAMES) this.lost = true;
      return;
    }
    this.belowFrames = Math.max(0, this.belowFrames - 1);
    this.baseline += (this.fit - this.baseline) * BASELINE_LEARNING;
  }

  /** Andamento: quando a posição mais provável avança um acorde, a duração no anterior entra na média. */
  private learnTempo(): void {
    let top = 0;
    for (let i = 1; i < this.belief.length; i++) if (this.belief[i] > this.belief[top]) top = i;
    if (top === this.bestStep) {
      this.framesOnBest++;
      return;
    }
    if (top === this.bestStep + 1 && this.belief[top] > 0.5) {
      const measured = Math.min(MAX_FRAMES_PER_CHORD, Math.max(MIN_FRAMES_PER_CHORD, this.framesOnBest));
      this.framesPerChord += (measured - this.framesPerChord) * TEMPO_LEARNING;
    }
    this.bestStep = top;
    this.framesOnBest = 0;
  }

  /** Para o diagnóstico: acorde da cifra mais parecido com o som agora, e o andamento aprendido. */
  heardChord(chroma: number[]): { chord: string; similarity: number } {
    let chord = "";
    let similarity = 0;
    for (const s of this.steps) {
      if (!s.template.length) continue;
      const sim = cosine(chroma, s.template);
      if (sim > similarity) {
        similarity = sim;
        chord = s.chord;
      }
    }
    return { chord, similarity };
  }

  /** Progresso (0–1) dentro da linha: em qual dos acordes dela a crença está (para a rolagem contínua). */
  lineProgress(line: number): number {
    let mass = 0;
    let weighted = 0;
    let k = 0;
    let count = 0;
    this.steps.forEach((s) => s.line === line && count++);
    this.steps.forEach((s, i) => {
      if (s.line !== line) return;
      mass += this.belief[i];
      weighted += this.belief[i] * (k + 0.5);
      k++;
    });
    return mass > 0 && count > 0 ? weighted / mass / count : 0;
  }

  /** Linha em que a tela está firme (-1 = nenhuma): o modelo se apoia nela enquanto o som confirma. */
  setAnchor(line: number): void {
    this.anchor = line;
  }

  /** true enquanto o modelo está "recalculando a rota" (a posição atual não explica o som). */
  isLost(): boolean {
    return this.lost;
  }

  secondsPerChord(): number {
    return this.framesPerChord / 10;
  }

  /**
   * Linha mais provável e sua probabilidade. Linhas com os MESMOS acordes são o mesmo lugar para o ouvido:
   * a certeza delas é somada e vale a mais provável do grupo (empate → a primeira, por onde se costuma entrar numa
   * parte). Sem isso, um salto para uma parte repetida ficaria dividido 50/50 e a tela nunca se firmaria.
   */
  best(near = -1): { index: number; probability: number } {
    const byLine = new Map<number, number>();
    const signature = new Map<number, string>();
    this.steps.forEach((s, i) => {
      byLine.set(s.line, (byLine.get(s.line) ?? 0) + this.belief[i]);
      signature.set(s.line, `${signature.get(s.line) ?? ""}|${s.chord}`);
    });
    const groups = new Map<string, { total: number; line: number; p: number; close: boolean }>();
    for (const [line, p] of byLine) {
      const key = signature.get(line) ?? String(line);
      const g = groups.get(key);
      // Continuidade: entre linhas iguais, a que está logo à frente da posição atual ganha das distantes.
      const close = near >= 0 && line >= near && line <= near + 6;
      if (!g) groups.set(key, { total: p, line, p, close });
      else {
        g.total += p;
        if ((close && !g.close) || (close === g.close && p > g.p * 1.05)) {
          g.line = line;
          g.p = p;
          g.close = close;
        }
      }
    }
    let index = 0;
    let probability = 0;
    for (const g of groups.values()) {
      if (g.total > probability) {
        index = g.line;
        probability = g.total;
      }
    }
    return { index, probability };
  }
}
