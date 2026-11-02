/** Comandos de voz do dono no modo palco: uma pergunta "choice" ao Jev, com lista fechada (nunca inventa uma ação). */

export type StageCommand =
  | { type: "next" }
  | { type: "prev" }
  | { type: "tone_up" }
  | { type: "tone_down" }
  | { type: "pause" }
  | { type: "go_to"; position: number };

/** Só age acima disto (no kit Jev, pedidos de verdade vêm com 97–100%; conversa solta fica abaixo). */
export const COMMAND_MIN_PROBABILITY = 0.7;

type SongOption = { position: number; title: string; artist: string };

const FIXED: Record<string, string> = {
  proxima: 'ir para a PRÓXIMA música do setlist: "próxima", "próxima música", "pode passar", "vamos pra próxima"',
  anterior: 'voltar para a música ANTERIOR: "volta uma", "música anterior", "volta a outra"',
  subir_tom: 'subir o tom meio tom: "sobe meio tom", "sobe o tom", "mais agudo"',
  descer_tom: 'descer o tom meio tom: "desce meio tom", "abaixa o tom", "mais grave"',
  pausar: 'parar de seguir a letra por enquanto: "pausa o palco", "para de seguir", "segura aí"',
};
const NONE = "nenhum";
const NONE_DESC =
  "nenhum pedido para o palco: cantando a letra, falando com a plateia, contando um caso, agradecendo, afinando, ou citando outra música sem pedir para ir";

export function commandQuestion(songs: SongOption[]) {
  const criteria: Record<string, string> = { ...FIXED };
  for (const s of songs) {
    criteria[`musica_${s.position}`] = `pede para ir à música «${s.title}» (${s.artist}) pelo nome: "vamos de ${s.title}", "agora ${s.title}"`;
  }
  criteria[NONE] = NONE_DESC;
  return {
    type: "choice" as const,
    instructions:
      'Modo palco de um setlist de cifras: o dono da banda fala ao microfone enquanto toca. Na frase em `frase`, ele fez um PEDIDO DIRETO ao palco para trocar de música, mudar o tom ou pausar? A lista de músicas está em `musicas`. Letra cantada, conversa com a plateia ou só citar uma música é "nenhum". Se ele se corrigiu ("próxima… não, pera"), vale o que disse por último.',
    criteria,
  };
}

/** Converte a resposta do Jev em comando, ou null se for "nenhum" ou não houver confiança. */
export function toStageCommand(choice: string, probability: number): StageCommand | null {
  if (probability < COMMAND_MIN_PROBABILITY || choice === NONE) return null;
  if (choice === "proxima") return { type: "next" };
  if (choice === "anterior") return { type: "prev" };
  if (choice === "subir_tom") return { type: "tone_up" };
  if (choice === "descer_tom") return { type: "tone_down" };
  if (choice === "pausar") return { type: "pause" };
  const m = choice.match(/^musica_(\d+)$/);
  return m ? { type: "go_to", position: Number(m[1]) } : null;
}
