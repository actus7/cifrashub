/** Área da tela realmente visível: a janela menos o header fixo em cima e as barras fixas embaixo. */
export type VisibleBand = { top: number; bottom: number };

/** Se a linha já está a menos disto do centro (fração da área visível), não rola: evita trancos a cada linha. */
const DEAD_ZONE = 0.12;

/**
 * Quanto rolar (px, positivo = para baixo) para o centro da linha ficar no centro da área visível.
 * 0 quando a linha já está perto o bastante do centro.
 */
export function centerScrollDelta(line: { top: number; height: number }, band: VisibleBand): number {
  const visible = band.bottom - band.top;
  if (visible <= 0) return 0;
  const delta = line.top + line.height / 2 - (band.top + visible / 2);
  return Math.abs(delta) < visible * DEAD_ZONE ? 0 : delta;
}

/** Mede a área visível a partir dos elementos marcados com data-scroll-inset="top" | "bottom". */
export function visibleBand(): VisibleBand {
  let top = 0;
  let bottom = window.innerHeight;
  document.querySelectorAll<HTMLElement>("[data-scroll-inset]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    if (el.dataset.scrollInset === "top") top = Math.max(top, r.bottom);
    else bottom = Math.min(bottom, r.top);
  });
  return { top, bottom };
}

/** Rola a página para deixar o elemento no meio da área visível (leva em conta o tamanho da tela e as barras). */
export function scrollToVisibleCenter(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const delta = centerScrollDelta({ top: r.top, height: r.height }, visibleBand());
  if (delta !== 0) window.scrollBy({ top: delta, behavior: "smooth" });
}
