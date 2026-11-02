"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scrollToVisibleCenter } from "@/lib/center-scroll";
import { matchLine, normalizeWords } from "@/lib/lyrics-follow";
import { startSpeech } from "@/lib/speech";
import { startWhisper, whisperAvailable } from "@/lib/whisper-client";

export type LyricsFollowState =
  | { status: "idle" }
  | { status: "following"; engine: "whisper" | "browser" }
  | { status: "error"; message: string };

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

export function clearLyricFocus() {
  lyricElements().forEach((el) => el.removeAttribute(ACTIVE_ATTR));
}

/**
 * Ouve a voz e mantém no centro da tela a linha da letra que está sendo cantada.
 * As linhas vêm do DOM (`[data-follow]`, em ordem), então funciona com colunas, tom e cifra simplificada.
 * `onLine` recebe o índice da linha sempre que ela muda (usado pelo modo palco).
 * `onSpeech` recebe cada frase fechada que NÃO bate com a letra (candidata a comando de voz).
 */
export function useLyricsFollow(onLine?: (index: number) => void, onSpeech?: (phrase: string) => void) {
  const [state, setState] = useState<LyricsFollowState>({ status: "idle" });
  const stopRef = useRef<(() => void) | null>(null);
  const onLineRef = useRef(onLine);
  const onSpeechRef = useRef(onSpeech);
  useEffect(() => {
    onLineRef.current = onLine;
    onSpeechRef.current = onSpeech;
  }, [onLine, onSpeech]);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    clearLyricFocus();
    setState({ status: "idle" });
  }, []);

  useEffect(() => () => stopRef.current?.(), []);

  const start = useCallback(async () => {
    stopRef.current?.();
    let current = -1;
    let lines: string[][] = [];
    const ensureLines = () => {
      if (lines.length === 0) lines = lyricElements().map((el) => normalizeWords(el.dataset.lyric ?? ""));
    };
    const listener = {
      onText: (text: string) => {
        ensureLines();
        const next = matchLine(lines, normalizeWords(text), current);
        if (next === current || next < 0) return;
        current = next;
        focusLyricLine(next);
        onLineRef.current?.(next);
      },
      onFinal: (segment: string) => {
        if (!onSpeechRef.current) return;
        ensureLines();
        // Trecho que é letra cantada não é comando.
        if (matchLine(lines, normalizeWords(segment), -1) !== -1) return;
        onSpeechRef.current(segment);
      },
      onError: (message: string) => {
        stopRef.current?.();
        stopRef.current = null;
        setState({ status: "error", message });
      },
    };

    // Whisper (servidor) entende canto; o reconhecedor do navegador é para fala e fica de reserva.
    if (await whisperAvailable()) {
      // Dica para o Whisper: a letra a partir da posição atual (ou o começo, se ainda não achou).
      const prompt = () => {
        const els = lyricElements();
        const from = Math.max(0, current);
        return els
          .slice(from, from + 10)
          .map((el) => el.dataset.lyric)
          .filter(Boolean)
          .join(" ");
      };
      try {
        stopRef.current = await startWhisper(listener, prompt);
        setState({ status: "following", engine: "whisper" });
      } catch {
        setState({ status: "error", message: "Não foi possível ligar o microfone." });
      }
      return;
    }

    const stopSpeech = startSpeech(listener);
    if (!stopSpeech) {
      setState({
        status: "error",
        message: "Este navegador não tem reconhecimento de voz. Use o Chrome, o Edge ou o Safari.",
      });
      return;
    }
    stopRef.current = stopSpeech;
    setState({ status: "following", engine: "browser" });
  }, []);

  return { state, start, stop };
}
