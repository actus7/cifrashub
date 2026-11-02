"use client";

import { scrollToVisibleCenter } from "@/lib/center-scroll";
import { repeatEdges } from "@/lib/repeat-marks";

const ACTIVE_ATTR = "data-lyric-active";

/** As posições da música na tela, em ordem (linhas com letra e/ou acordes). */
export function lyricElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-follow]"));
}

/** Move o destaque e põe a linha no meio da área visível (descontando header e barras fixas). */
export function focusLyricLine(index: number) {
  const els = lyricElements();
  els.forEach((el, i) => el.toggleAttribute(ACTIVE_ATTR, i === index));
  const el = els[index];
  if (el) scrollToVisibleCenter(el);
}

/** Só o destaque (sem rolar): usado quando a rolagem é contínua (FollowScroller). */
export function highlightLyricLine(index: number) {
  lyricElements().forEach((el, i) => el.toggleAttribute(ACTIVE_ATTR, i === index));
}

export function clearLyricFocus() {
  lyricElements().forEach((el) => el.removeAttribute(ACTIVE_ATTR));
}

/**
 * Caminhos de repetição lidos da tela: "(2x)" no fim da linha, "(2x)" sozinho numa linha (vale para a de cima)
 * ou "[Refrão 2x]" no nome da parte. A "estrofe" de uma repetição é o bloco entre linhas em branco (algumas
 * cifras vêm numa seção só, então a seção sozinha não basta); "[Refrão 2x]" repete a parte inteira.
 */
export function repeatEdgesOnScreen() {
  const rows: { repeat: number | null; section: number; sectionRepeat: number | null }[] = [];
  const sectionRows: { stanza: number; section: number; sectionRepeat: number | null }[] = [];
  let stanza = 0;
  let lastSection = -2;
  document.querySelectorAll<HTMLElement>("[data-row]").forEach((el) => {
    const sectionEl = el.closest<HTMLElement>("[data-section]");
    const section = sectionEl ? Number(sectionEl.dataset.section) : -1;
    if (section !== lastSection) {
      stanza++;
      lastSection = section;
    }
    if (el.dataset.repeatMark) {
      const last = rows[rows.length - 1];
      if (last) last.repeat = Number(el.dataset.repeatMark);
      return;
    }
    if (el.dataset.follow === undefined) {
      stanza++; // linha em branco: termina a estrofe
      return;
    }
    const sectionRepeat = sectionEl?.dataset.sectionRepeat ? Number(sectionEl.dataset.sectionRepeat) : null;
    rows.push({ repeat: el.dataset.repeat ? Number(el.dataset.repeat) : null, section: stanza, sectionRepeat: null });
    sectionRows.push({ stanza, section, sectionRepeat });
  });
  const edges = repeatEdges(rows);
  // "[Refrão 2x]": do fim da parte volta ao começo dela (a parte inteira, não só a última estrofe).
  const bySection = repeatEdges(sectionRows.map((r) => ({ repeat: null, section: r.section, sectionRepeat: r.sectionRepeat })));
  return [...edges, ...bySection];
}
