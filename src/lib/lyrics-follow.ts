/** Palavras reconhecidas (as mais recentes) usadas para achar a linha cantada. */
export const RECENT_WORDS = 8;
/** Quantas linhas para trás/frente da atual são procuradas primeiro (refrão repetido = próxima ocorrência). */
const LOOK_BACK = 2;
const LOOK_AHEAD = 8;
/** Fração mínima das palavras da linha ouvidas para andar perto da posição atual. */
const NEAR_THRESHOLD = 0.5;
/** Para saltar para longe (ex.: cantor pulou uma estrofe), a linha tem de bater bem mais. */
const FAR_THRESHOLD = 0.75;
const MIN_MATCHED_WORDS = 2;

export function normalizeWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Média entre "quanto da linha foi ouvido" e "quanto do que foi ouvido a linha explica"
 * (0 se casar menos de 2 palavras). A segunda parte desempata linhas curtas contidas em linhas maiores.
 */
export function lineScore(lineWords: string[], heard: Set<string>): number {
  if (lineWords.length === 0) return 0;
  let matched = 0;
  for (const w of lineWords) if (heard.has(w)) matched++;
  if (matched < Math.min(MIN_MATCHED_WORDS, lineWords.length)) return 0;
  const lineSet = new Set(lineWords);
  let covered = 0;
  for (const w of heard) if (lineSet.has(w)) covered++;
  return (matched / lineWords.length + covered / heard.size) / 2;
}

function bestIn(lines: string[][], heard: Set<string>, from: number, to: number, current: number) {
  let best = -1;
  let bestScore = 0;
  // Empate: linha à frente (ou na atual) ganha da que ficou para trás; entre elas, a mais perto.
  const rank = (i: number) => (i >= current ? 0 : 1000) + Math.abs(i - current);
  for (let i = Math.max(0, from); i <= Math.min(lines.length - 1, to); i++) {
    const score = lineScore(lines[i], heard);
    if (score > bestScore || (score === bestScore && score > 0 && rank(i) < rank(best))) {
      best = i;
      bestScore = score;
    }
  }
  return { index: best, score: bestScore };
}

/**
 * Índice da linha que está sendo cantada, ou `current` se a fala não bate com a letra.
 * `lines` são as palavras normalizadas de cada linha; `recentWords`, o fim do que foi reconhecido.
 */
export function matchLine(lines: string[][], recentWords: string[], current: number): number {
  const heard = new Set(recentWords.slice(-RECENT_WORDS));
  if (heard.size === 0) return current;
  const near = bestIn(lines, heard, current - LOOK_BACK, current + LOOK_AHEAD, Math.max(current, 0));
  if (near.index !== -1 && near.score >= NEAR_THRESHOLD) return near.index;
  const far = bestIn(lines, heard, 0, lines.length - 1, Math.max(current, 0));
  if (far.index !== -1 && far.score >= FAR_THRESHOLD) return far.index;
  return current;
}
