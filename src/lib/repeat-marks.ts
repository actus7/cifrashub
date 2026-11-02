/**
 * Marcas de repetição das cifras: "(2x)", "2x", "(4X)", "x2", "(3 vezes)" no fim de uma linha ou no nome da parte
 * ("[Refrão 2x]"). Devolve quantas vezes (2–20) ou null.
 */
const REPEAT_AT_END = [
  /(?:^|[\s([])(\d{1,2})\s*[xX×]\s*[)\]]?\s*$/,
  /(?:^|[\s([])[xX×]\s*(\d{1,2})\s*[)\]]?\s*$/,
  /(?:^|[\s([])(\d{1,2})\s*vezes\s*[)\]]?\s*$/i,
];

export function parseRepeat(text: string): number | null {
  const t = text.trim();
  for (const re of REPEAT_AT_END) {
    const m = t.match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (n >= 2 && n <= 20) return n;
  }
  return null;
}

/** O texto sem a marca de repetição (para comparar com o que é cantado). */
export function stripRepeat(text: string): string {
  if (parseRepeat(text) === null) return text;
  return text.replace(/\s*[([]?\s*(?:\d{1,2}\s*(?:[xX×]|vezes)|[xX×]\s*\d{1,2})\s*[)\]]?\s*$/i, "").trim();
}

/** Uma "estrofe" maior que isto não é estrofe (cifra sem linhas em branco): o "(Nx)" repete só a linha. */
const MAX_STANZA_LINES = 8;

/**
 * Caminhos de repetição para o seguidor: depois da linha `from`, a música pode voltar para `to`.
 * - linha com "(Nx)": volta ao começo dela mesma E ao começo da estrofe (as cifras usam dos dois jeitos;
 *   o som decide qual aconteceu);
 * - parte com "Nx" no nome: do fim da parte volta ao começo dela.
 */
export function repeatEdges(
  rows: { repeat: number | null; section: number; sectionRepeat: number | null }[],
): { from: number; to: number }[] {
  const firstOfSection = new Map<number, number>();
  const lastOfSection = new Map<number, number>();
  rows.forEach((r, i) => {
    if (!firstOfSection.has(r.section)) firstOfSection.set(r.section, i);
    lastOfSection.set(r.section, i);
  });
  const edges = new Map<string, { from: number; to: number }>();
  const add = (from: number, to: number) => edges.set(`${from}>${to}`, { from, to });
  rows.forEach((r, i) => {
    if (r.repeat) {
      add(i, i);
      const start = firstOfSection.get(r.section) ?? i;
      if (start !== i && i - start < MAX_STANZA_LINES) add(i, start);
    }
    if (r.sectionRepeat && lastOfSection.get(r.section) === i) add(i, firstOfSection.get(r.section) ?? i);
  });
  return [...edges.values()];
}
