/**
 * Separa "o que o modelo acha" de "o que a tela mostra" (histerese). O modelo pode oscilar entre duas linhas
 * de quadro em quadro; a tela só muda quando a nova linha se mantém por um tempo, e voltar exige muito mais
 * evidência do que avançar — para quem está tocando, um atraso pequeno é melhor do que a tela indo e voltando.
 */

type Rule = { minProbability: number; holdFrames: number };

/** Linha seguinte (o caso normal da música): 45% por 3 quadros (~0,3 s). */
const NEXT: Rule = { minProbability: 0.45, holdFrames: 3 };
/** Algumas linhas à frente (pulou uma linha curta): 65% por ~0,8 s. */
const AHEAD: Rule = { minProbability: 0.65, holdFrames: 8 };
/** Para trás ou para longe (o músico saltou de parte — raro): 90% por ~3 s. */
const FAR_OR_BACK: Rule = { minProbability: 0.9, holdFrames: 30 };
/** "Algumas linhas à frente" vai até aqui. */
const AHEAD_LINES = 6;
/**
 * Fase de reconhecimento (a tela ainda não mostrou nada): entender onde a pessoa está antes de mexer a tela.
 * O começo da música é o palpite natural (50% por 1 s); qualquer outro ponto precisa se provar (85% por 4 s).
 */
const START_LINES = 2;
const ACQUIRE_START: Rule = { minProbability: 0.5, holdFrames: 10 };
const ACQUIRE_ELSEWHERE: Rule = { minProbability: 0.85, holdFrames: 40 };
/** Quadros descontados da confirmação quando o modelo hesita por um instante para outra linha. */
const HESITATION_COST = 3;

export class LineStabilizer {
  private shown = -1;
  private candidate = -1;
  private held = 0;

  /** Linha mostrada na tela agora. */
  get line(): number {
    return this.shown;
  }

  /** true enquanto ainda está entendendo onde a música está (nada mostrado). */
  get locating(): boolean {
    return this.shown < 0;
  }

  private ruleFor(target: number): Rule {
    if (this.shown < 0) return target <= START_LINES ? ACQUIRE_START : ACQUIRE_ELSEWHERE;
    if (target === this.shown + 1) return NEXT;
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
      // Evidência fraca não confirma nada, mas também não apaga a confirmação: só desconta (a troca de uma linha
      // para a seguinte passa por um instante de menos certeza).
      this.held = Math.max(0, this.held - (best.index === this.candidate ? 1 : HESITATION_COST));
      return this.shown;
    }
    if (best.index !== this.candidate) {
      // Confirmamos uma TRAJETÓRIA, não uma linha parada: se o candidato avança na sequência (16 → 17), a música
      // está andando a partir de lá — a contagem continua.
      const progressing = this.candidate >= 0 && best.index > this.candidate && best.index <= this.candidate + 2;
      if (!progressing && this.held > HESITATION_COST) {
        // Uma hesitação de um quadro só desconta; a confirmação acumulada não se perde à toa.
        this.held -= HESITATION_COST;
        return this.shown;
      }
      this.candidate = best.index;
      if (!progressing) this.held = 0;
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
