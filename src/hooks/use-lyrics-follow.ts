"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { matchLine, normalizeWords } from "@/lib/lyrics-follow";
import { startSpeech } from "@/lib/speech";

export type LyricsFollowState = { status: "idle" } | { status: "following" } | { status: "error"; message: string };

const ACTIVE_ATTR = "data-lyric-active";

function lyricElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-lyric]"));
}

/** Move o destaque e centraliza a linha. */
export function focusLyricLine(index: number) {
  const els = lyricElements();
  els.forEach((el, i) => el.toggleAttribute(ACTIVE_ATTR, i === index));
  els[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function clearLyricFocus() {
  lyricElements().forEach((el) => el.removeAttribute(ACTIVE_ATTR));
}

/**
 * Ouve a voz e mantém no centro da tela a linha da letra que está sendo cantada.
 * As linhas vêm do DOM (`[data-lyric]`, em ordem), então funciona com colunas, tom e cifra simplificada.
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

  const start = useCallback(() => {
    stopRef.current?.();
    let current = -1;
    let lines: string[][] = [];
    const stopSpeech = startSpeech({
      onText: (text) => {
        if (lines.length === 0) lines = lyricElements().map((el) => normalizeWords(el.dataset.lyric ?? ""));
        const next = matchLine(lines, normalizeWords(text), current);
        if (next === current || next < 0) return;
        current = next;
        focusLyricLine(next);
        onLineRef.current?.(next);
      },
      onFinal: (segment) => {
        if (!onSpeechRef.current) return;
        if (lines.length === 0) lines = lyricElements().map((el) => normalizeWords(el.dataset.lyric ?? ""));
        // Trecho que é letra cantada não é comando.
        if (matchLine(lines, normalizeWords(segment), -1) !== -1) return;
        onSpeechRef.current(segment);
      },
      onError: (message) => {
        stopRef.current = null;
        setState({ status: "error", message });
      },
    });
    if (!stopSpeech) {
      setState({
        status: "error",
        message: "Este navegador não tem reconhecimento de voz. Use o Chrome, o Edge ou o Safari.",
      });
      return;
    }
    stopRef.current = stopSpeech;
    setState({ status: "following" });
  }, []);

  return { state, start, stop };
}
