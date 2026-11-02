"use client";

import { scrollToVisibleCenter } from "@/lib/center-scroll";

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
