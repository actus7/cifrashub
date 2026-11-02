/**
 * Acompanha em que linha da letra o cantor está, a partir das palavras reconhecidas (Web Speech).
 *
 * Pergunta que o algoritmo faz: "as últimas palavras ouvidas são o COMEÇO de qual linha?" (como um seguidor de
 * karaokê). Enquanto a pessoa está no meio de uma linha, nenhuma outra linha começa ali, então a posição fica;
 * quando ela começa a próxima, as 2–3 primeiras palavras já bastam. Refrão repetido: entre linhas iguais, vence a
 * próxima ocorrência à frente. Palavras com erro de reconhecimento ("folga" × "fôlego") contam por semelhança.
 */

/** Quantas palavras ouvidas (as mais recentes) entram na comparação. */
export const RECENT_WORDS = 8;
/** Linhas procuradas primeiro, em volta da atual. */
const LOOK_BACK = 2;
const LOOK_AHEAD = 6;
type Rule = { minMatched: number; minRatio: number };
/** A próxima linha é a mais provável: 2 palavras de conteúdo do começo dela bastam. */
const NEXT: Rule = { minMatched: 2, minRatio: 0.6 };
/** Outras linhas perto da atual: um pouco mais de evidência. */
const NEAR: Rule = { minMatched: 3, minRatio: 0.7 };
/** Salto para longe (cantor pulou uma parte). */
const FAR: Rule = { minMatched: 3, minRatio: 0.8 };

/** Palavras curtas e comuns: aparecem em quase toda linha e criariam "começos" falsos. */
const STOPWORDS = new Set(
  "a o e as os um uma uns umas de da do das dos que se em na no nas nos me te ti lhe pra pro por mas ha eu tu ao aos com".split(" "),
);
const isContent = (w: string) => !STOPWORDS.has(w);

export function normalizeWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Palavras iguais, ou parecidas o bastante para um erro de reconhecimento (mesmo começo / 1 letra de diferença). */
export function similarWords(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  if (a.slice(0, 3) === b.slice(0, 3) && Math.abs(a.length - b.length) <= 2) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  // distância de edição ≤ 1
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Quantas palavras de conteúdo das últimas ouvidas correspondem ao começo da linha (0 se não é um começo).
 * Tenta finais de tamanho k: as k palavras ouvidas × as k+2 primeiras da linha, em ordem (tolera palavras perdidas).
 */
export function prefixMatch(line: string[], heard: string[], rule: Rule): number {
  const lineContent = line.filter(isContent).length;
  if (lineContent === 0) return 0;
  const need = Math.min(rule.minMatched, lineContent);
  let best = 0;
  for (let k = 1; k <= Math.min(heard.length, line.length + 1); k++) {
    const tail = heard.slice(-k);
    // Tem de ser um COMEÇO: a 1ª palavra ouvida do trecho é a 1ª ou a 2ª da linha (o reconhecedor às vezes perde a 1ª).
    const anchored = similarWords(tail[0], line[0]) || (line.length > 1 && similarWords(tail[0], line[1]));
    if (!anchored) continue;
    const head = line.slice(0, k + 2);
    let matched = 0;
    let from = 0;
    for (const w of tail) {
      const at = head.findIndex((x, idx) => idx >= from && similarWords(w, x));
      if (at === -1) continue;
      from = at + 1;
      if (isContent(w)) matched++;
    }
    const tailContent = tail.filter(isContent).length;
    if (matched >= need && tailContent > 0 && matched / tailContent >= rule.minRatio) best = Math.max(best, matched);
  }
  return best;
}

function bestStart(lines: string[][], heard: string[], from: number, to: number, current: number, rule: Rule) {
  // Empate: à frente da atual ganha de atrás; entre elas, a mais perto.
  const rank = (i: number) => (i > current ? 0 : 1000) + Math.abs(i - current);
  let best = -1;
  let bestMatched = 0;
  // Uma linha idêntica à atual (refrão repetido) não "começa" enquanto a atual está sendo cantada: senão a tela
  // pularia para a repetição seguinte no meio da linha.
  // ponytail: a mesma linha cantada 2x seguidas fica na 1ª até a linha seguinte começar.
  const currentText = current >= 0 ? lines[current]?.join(" ") : undefined;
  for (let i = Math.max(0, from); i <= Math.min(lines.length - 1, to); i++) {
    if (i === current || lines[i].join(" ") === currentText) continue;
    const matched = prefixMatch(lines[i], heard, i === current + 1 ? NEXT : rule);
    if (matched > bestMatched || (matched === bestMatched && matched > 0 && rank(i) < rank(best))) {
      best = i;
      bestMatched = matched;
    }
  }
  return best;
}

/**
 * Índice da linha cantada agora, ou `current` se nenhuma outra linha está começando.
 * `lines` = palavras normalizadas de cada linha; `recentWords` = fim do que foi reconhecido.
 */
export function matchLine(lines: string[][], recentWords: string[], current: number): number {
  const heard = recentWords.slice(-RECENT_WORDS);
  if (heard.length === 0) return current;
  const near = bestStart(lines, heard, current - LOOK_BACK, current + LOOK_AHEAD, current, NEAR);
  if (near !== -1) return near;
  const far = bestStart(lines, heard, 0, lines.length - 1, current, FAR);
  return far !== -1 ? far : current;
}
