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

/** Fração da distância percorrida a cada quadro da tela (~60/s): 0,08 = desliza em ~0,5 s, sem trancos. */
const EASE_PER_FRAME = 0.08;
/** Se a pessoa rolar com a mão, a rolagem automática espera este tempo antes de voltar. */
const MANUAL_PAUSE_MS = 4_000;

/**
 * Rolagem contínua e suave para o "Seguir a música": o ponto-alvo anda entre o centro da linha atual e o da próxima
 * conforme o progresso dentro da linha (qual acorde dela está tocando), e a página se aproxima dele um pouco a cada
 * quadro (como um teleprompter). Rolar com a mão pausa por alguns segundos.
 */
export class FollowScroller {
  private line: HTMLElement | null = null;
  private next: HTMLElement | null = null;
  private progress = 0;
  private raf = 0;
  private pausedUntil = 0;
  private readonly onManual = () => {
    this.pausedUntil = performance.now() + MANUAL_PAUSE_MS;
  };

  start() {
    window.addEventListener("wheel", this.onManual, { passive: true });
    window.addEventListener("touchmove", this.onManual, { passive: true });
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (!this.line || performance.now() < this.pausedUntil) return;
      const band = visibleBand();
      const center = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      };
      const from = center(this.line);
      const point = this.next ? from + (center(this.next) - from) * this.progress : from;
      const delta = point - (band.top + (band.bottom - band.top) / 2);
      if (Math.abs(delta) <= 1) return;
      // Passo mínimo de 1 px: frações menores são arredondadas para zero e a tela pararia antes do centro.
      const step = Math.sign(delta) * Math.max(1, Math.abs(delta) * EASE_PER_FRAME);
      window.scrollBy({ top: step, behavior: "instant" });
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Linha atual, a próxima e o progresso (0–1) dentro da atual. */
  setTarget(line: HTMLElement | null, next: HTMLElement | null, progress: number) {
    this.line = line;
    this.next = next;
    this.progress = Math.min(1, Math.max(0, progress));
  }

  stop() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("wheel", this.onManual);
    window.removeEventListener("touchmove", this.onManual);
    this.line = null;
  }
}
