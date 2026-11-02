"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChordFollower } from "@/lib/chord-follow";
import { LineStabilizer } from "@/lib/line-stabilizer";
import { lineWordScores, matchLine, normalizeWords } from "@/lib/lyrics-follow";
import { startMicChroma } from "@/lib/mic-chroma";
import { startSpeech, type SpeechListener } from "@/lib/speech";
import { startWhisper, whisperAvailable } from "@/lib/whisper-client";
import { clearLyricFocus, highlightLyricLine, lyricElements } from "@/hooks/use-lyrics-follow";
import { FollowScroller } from "@/lib/center-scroll";

/** Suavização do cromagrama (~0,5 s): a batida e o dedilhado não fazem o acorde "piscar". */
const SMOOTH = 0.3;
/** Palavras recentes consideradas como evidência. */
const WORD_WINDOW = 8;
/** Parciais do reconhecedor do navegador chegam muitas vezes: cada janela nova conta pela metade. */
const PARTIAL_WEIGHT = 0.5;
/** Limite do registro de diagnóstico (~30 min de quadros). */
const MAX_EVENTS = 20_000;
/**
 * Palavras apontando para longe da posição atual valem menos: palavras comuns ("aleluia") aparecem em várias
 * linhas e puxariam a posição para outra repetição.
 */
const WORDS_NEAR = { back: 2, ahead: 8, farWeight: 0.3 };
/** O painel ao vivo atualiza ~4×/s (os quadros são 10×/s). */
const DIAG_EVERY_MS = 250;

export type VoiceEngine = "whisper" | "browser" | "none";

export type FollowDiagnostics = {
  engine: VoiceEngine;
  /** Acorde da cifra mais parecido com o som agora. */
  chord: string;
  chordSimilarity: number;
  /** Últimas palavras que o transcritor entregou. */
  words: string;
  /** Linha que as palavras sozinhas apontariam (-1 = nenhuma). */
  wordsLine: number;
  /** Linha mostrada na tela (estabilizada). */
  line: number;
  /** Linha que o modelo acha agora e a certeza dele (pode oscilar; a tela não acompanha cada oscilação). */
  modelLine: number;
  probability: number;
  secondsPerChord: number;
  /** "Recalculando rota": a posição atual não explica o som. */
  lost: boolean;
  /** Ainda entendendo onde a música está (a tela não se mexe até decidir). */
  locating: boolean;
};

export type SongFollowState =
  | { status: "idle" }
  | { status: "following"; level: number; diag: FollowDiagnostics }
  | { status: "error"; message: string };

type DiagEvent =
  | { t: number; type: "frame"; level: number; chord: string; sim: number; line: number; model: number; p: number }
  | { t: number; type: "words"; text: string; wordsLine: number; final: boolean }
  | { t: number; type: "line"; line: number; p: number };

const EMPTY_DIAG: FollowDiagnostics = {
  engine: "none",
  chord: "",
  chordSimilarity: 0,
  words: "",
  wordsLine: -1,
  line: -1,
  modelLine: -1,
  probability: 0,
  secondsPerChord: 2,
  lost: false,
  locating: true,
};

/**
 * Segue a música combinando tudo: acordes tocados (a cada 100 ms), palavras cantadas (Whisper se configurado, senão o
 * reconhecedor do navegador) e o andamento aprendido, numa única crença de posição. A linha provável fica no meio da
 * tela. Guarda um registro para análise (`downloadDiagnostics`).
 * `shift` = semitons entre os acordes escritos e o que soa (o tom do player).
 */
export function useSongFollow(
  shift: number,
  { onLine, onSpeech }: { onLine?: (index: number) => void; onSpeech?: (phrase: string) => void } = {},
) {
  const [state, setState] = useState<SongFollowState>({ status: "idle" });
  const stopRef = useRef<(() => void) | null>(null);
  const followerRef = useRef<ChordFollower | null>(null);
  const currentRef = useRef(-1);
  const eventsRef = useRef<DiagEvent[]>([]);
  const callbacks = useRef({ onLine, onSpeech });
  useEffect(() => {
    callbacks.current = { onLine, onSpeech };
  }, [onLine, onSpeech]);

  const build = useCallback(
    (startLine: number) => {
      const lines = lyricElements().map((el) => (el.dataset.chords ?? "").split(" ").filter(Boolean));
      followerRef.current = new ChordFollower(lines, shift, startLine);
    },
    [shift],
  );

  // Mudou o tom durante a música: refaz os moldes a partir da linha atual.
  useEffect(() => {
    if (followerRef.current) build(currentRef.current);
  }, [build]);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    followerRef.current = null;
    currentRef.current = -1;
    clearLyricFocus();
    setState({ status: "idle" });
  }, []);

  useEffect(() => () => stopRef.current?.(), []);

  const start = useCallback(async () => {
    stopRef.current?.();
    build(-1);
    eventsRef.current = [];
    const t0 = performance.now();
    const log = (e: DiagEvent) => {
      if (eventsRef.current.length < MAX_EVENTS) eventsRef.current.push(e);
    };
    const words = lyricElements().map((el) => normalizeWords(el.dataset.lyric ?? ""));
    const diag: FollowDiagnostics = { ...EMPTY_DIAG };
    let lastDiagAt = 0;
    let lastWindow = "";
    const smooth = new Array<number>(12).fill(0);
    const stabilizer = new LineStabilizer();
    const scroller = new FollowScroller();
    scroller.start();
    const elements = lyricElements();

    const moveTo = (index: number, probability: number) => {
      if (index === currentRef.current) return;
      currentRef.current = index;
      highlightLyricLine(index);
      callbacks.current.onLine?.(index);
      log({ t: performance.now() - t0, type: "line", line: index, p: probability });
    };

    // Chamado uma vez por quadro de áudio: o estabilizador conta tempo em quadros.
    const decide = () => {
      const best = followerRef.current?.best(stabilizer.line);
      if (!best) return;
      diag.modelLine = best.index;
      diag.probability = best.probability;
      const shown = stabilizer.update(best);
      followerRef.current?.setAnchor(shown);
      diag.line = shown;
      diag.locating = stabilizer.locating;
      diag.lost = followerRef.current?.isLost() ?? false;
      if (shown < 0) return;
      moveTo(shown, best.probability);
      // Rolagem contínua: dentro da linha mostrada, desliza conforme o acorde em que a música está.
      const progress = best.index === shown ? (followerRef.current?.lineProgress(shown) ?? 0) : 0;
      scroller.setTarget(elements[shown] ?? null, elements[shown + 1] ?? null, progress);
    };

    const observeText = (text: string, final: boolean) => {
      const recent = normalizeWords(text).slice(-WORD_WINDOW);
      const key = recent.join(" ");
      if (!key || key === lastWindow) return;
      lastWindow = key;
      const at = currentRef.current;
      // Recalculando rota: as palavras valem em qualquer parte da música.
      const anywhere = at < 0 || (followerRef.current?.isLost() ?? false);
      const scores = lineWordScores(words, recent).map((x, i) => {
        const near = anywhere || (i >= at - WORDS_NEAR.back && i <= at + WORDS_NEAR.ahead);
        return x * (final ? 1 : PARTIAL_WEIGHT) * (near ? 1 : WORDS_NEAR.farWeight);
      });
      followerRef.current?.observeWords(scores);
      diag.words = recent.join(" ");
      diag.wordsLine = matchLine(words, recent, -1);
      log({ t: performance.now() - t0, type: "words", text: key, wordsLine: diag.wordsLine, final });
    };

    const listener: SpeechListener = {
      onText: (text) => observeText(text, diag.engine === "whisper"),
      onFinal: (segment) => {
        observeText(segment, true);
        const onSpeech = callbacks.current.onSpeech;
        // Trecho que não é letra cantada pode ser um comando de voz (modo palco).
        if (onSpeech && matchLine(words, normalizeWords(segment), -1) === -1) onSpeech(segment);
      },
      onError: () => {
        // Sem voz, segue só pelos acordes.
        diag.engine = "none";
      },
    };

    const stops: (() => void)[] = [() => scroller.stop()];
    try {
      stops.push(
        await startMicChroma(({ level, chroma }) => {
          const follower = followerRef.current;
          if (!follower) return;
          const now = performance.now();
          if (chroma) {
            for (let i = 0; i < 12; i++) smooth[i] = smooth[i] * (1 - SMOOTH) + chroma[i] * SMOOTH;
            follower.step(smooth);
            const heard = follower.heardChord(smooth);
            diag.chord = heard.chord;
            diag.chordSimilarity = heard.similarity;
            diag.secondsPerChord = follower.secondsPerChord();
            decide();
            log({ t: now - t0, type: "frame", level, chord: heard.chord, sim: heard.similarity, line: diag.line, model: diag.modelLine, p: diag.probability });
          }
          if (now - lastDiagAt >= DIAG_EVERY_MS) {
            lastDiagAt = now;
            setState({ status: "following", level, diag: { ...diag } });
          }
        }),
      );
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Não foi possível ligar o microfone." });
      return;
    }

    // Voz: Whisper (entende canto) se o servidor tiver a chave; senão o reconhecedor do navegador.
    if (await whisperAvailable()) {
      const prompt = () =>
        lyricElements()
          .slice(Math.max(0, currentRef.current), Math.max(0, currentRef.current) + 10)
          .map((el) => el.dataset.lyric)
          .filter(Boolean)
          .join(" ");
      try {
        stops.push(await startWhisper(listener, prompt));
        diag.engine = "whisper";
      } catch {
        diag.engine = "none";
      }
    } else {
      const stopSpeech = startSpeech(listener);
      if (stopSpeech) {
        stops.push(stopSpeech);
        diag.engine = "browser";
      }
    }

    stopRef.current = () => stops.forEach((s) => s());
    setState({ status: "following", level: 0, diag: { ...diag } });
  }, [build]);

  /** Baixa o registro da sessão (quadros, palavras e trocas de linha) para análise. */
  const downloadDiagnostics = useCallback(() => {
    const lines = lyricElements().map((el, i) => ({ i, chords: el.dataset.chords ?? "", lyric: el.dataset.lyric ?? "" }));
    const blob = new Blob([JSON.stringify({ shift, lines, events: eventsRef.current }, null, 0)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostico-seguir-musica-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [shift]);

  return { state, start, stop, downloadDiagnostics };
}
