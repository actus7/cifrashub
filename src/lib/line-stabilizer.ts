/**
 * Separa "o que o modelo acha" de "o que a tela mostra" (histerese). O modelo pode oscilar entre duas linhas
 * de quadro em quadro; a tela só muda quando a nova linha se mantém por um tempo, e voltar exige muito mais
 * evidência do que avançar — para quem está tocando, um atraso pequeno é melhor do que a tela indo e voltando.
 */

type Rule = { minProbability: number; holdFrames: number };

/** Linha seguinte (o caso normal da música): 45% por 3 quadros (~0,3 s). */
const NEXT: Rule = { minProbability: 0.45, holdFrames: 3 };
/** Algumas linhas à frente (pulou uma linha curta): 60% por ~0,6 s. */
const AHEAD: Rule = { minProbability: 0.6, holdFrames: 6 };
/** Para trás ou para longe: 80% por ~1,5 s. */
const FAR_OR_BACK: Rule = { minProbability: 0.8, holdFrames: 15 };
/** "Algumas linhas à frente" vai até aqui. */
const AHEAD_LINES = 6;

export class LineStabilizer {
  private shown = -1;
  private candidate = -1;
  private held = 0;

  /** Linha mostrada na tela agora. */
  get line(): number {
    return this.shown;
  }

  private ruleFor(target: number): Rule {
    if (this.shown < 0 || target === this.shown + 1) return NEXT;
    if (target > this.shown && target - this.shown <= AHEAD_LINES) return AHEAD;
    return FAR_OR_BACK;
  }

  /** Recebe a linha mais provável do modelo (um quadro); devolve a linha a mostrar. */
  update(best: { index: number; probability: number }): number {
    if (best.index === this.shown) {
      this.candidate = -1;
      this.held = 0;
      return this.shown;
    }
    const rule = this.ruleFor(best.index);
    if (best.probability < rule.minProbability) {
      // Evidência fraca não mantém o candidato vivo.
      this.held = best.index === this.candidate ? Math.max(0, this.held - 1) : 0;
      return this.shown;
    }
    if (best.index !== this.candidate) {
      this.candidate = best.index;
      this.held = 0;
    }
    this.held++;
    if (this.held >= rule.holdFrames) {
      this.shown = best.index;
      this.candidate = -1;
      this.held = 0;
    }
    return this.shown;
  }
}
