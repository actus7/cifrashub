"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChordFollower } from "@/lib/chord-follow";
import { startMicChroma } from "@/lib/mic-chroma";
import { clearLyricFocus, focusLyricLine, lyricElements } from "@/hooks/use-lyrics-follow";

/** Suavização do cromagrama (~0,5 s): a batida e o dedilhado não fazem o acorde "piscar". */
const SMOOTH = 0.3;
/** Só move a tela quando a linha mais provável tem pelo menos esta probabilidade. */
const MIN_PROBABILITY = 0.5;

export type ChordFollowState =
  | { status: "idle" }
  | { status: "following"; level: number }
  | { status: "error"; message: string };

/**
 * Segue a música pelos acordes tocados (não precisa reconhecer palavras): a linha provável fica no meio da tela.
 * `shift` = semitons entre os acordes escritos e o que está soando (o tom da cifra no player).
 */
export function useChordFollow(shift: number, onLine?: (index: number) => void) {
  const [state, setState] = useState<ChordFollowState>({ status: "idle" });
  const releaseRef = useRef<(() => void) | null>(null);
  const followerRef = useRef<ChordFollower | null>(null);
  const currentRef = useRef(-1);
  const onLineRef = useRef(onLine);
  useEffect(() => {
    onLineRef.current = onLine;
  }, [onLine]);

  const build = useCallback((startLine: number) => {
    const lines = lyricElements().map((el) => (el.dataset.chords ?? "").split(" ").filter(Boolean));
    followerRef.current = new ChordFollower(lines, shift, startLine);
  }, [shift]);

  // Mudou o tom durante a música: refaz os moldes a partir da linha atual.
  useEffect(() => {
    if (followerRef.current) build(currentRef.current);
  }, [build]);

  const stop = useCallback(() => {
    releaseRef.current?.();
    releaseRef.current = null;
    followerRef.current = null;
    currentRef.current = -1;
    clearLyricFocus();
    setState({ status: "idle" });
  }, []);

  useEffect(() => () => releaseRef.current?.(), []);

  const start = useCallback(async () => {
    releaseRef.current?.();
    build(-1);
    const smooth = new Array<number>(12).fill(0);
    try {
      releaseRef.current = await startMicChroma(({ level, chroma }) => {
        const follower = followerRef.current;
        if (!follower) return;
        if (chroma) {
          for (let i = 0; i < 12; i++) smooth[i] = smooth[i] * (1 - SMOOTH) + chroma[i] * SMOOTH;
          follower.step(smooth);
          const best = follower.best();
          if (best.probability >= MIN_PROBABILITY && best.index !== currentRef.current) {
            currentRef.current = best.index;
            focusLyricLine(best.index);
            onLineRef.current?.(best.index);
          }
        }
        setState({ status: "following", level });
      });
      setState({ status: "following", level: 0 });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Não foi possível ligar o microfone." });
    }
  }, [build]);

  return { state, start, stop };
}
