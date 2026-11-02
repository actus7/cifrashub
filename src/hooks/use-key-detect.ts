"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bestShift } from "@/lib/key-detect";
import { startMicChroma } from "@/lib/mic-chroma";

/** O resultado na tela é recalculado a cada meio segundo. */
const DECIDE_MS = 500;
/** Média com decaimento: cada quadro pesa pouco e a memória dura ~20 s, então segue uma mudança de tom. */
const DECAY = 0.995;
/** Vantagem mínima da melhor transposição sobre a segunda para mostrar o tom. */
const MIN_CONFIDENCE = 0.04;
/** Quadros com som (≈1,5 s) antes do primeiro palpite. */
const MIN_FRAMES = 15;

export type KeyDetectState =
  | { status: "idle" }
  | { status: "listening"; level: number; shift: number | null; remainingMs: number | null }
  /** Terminou sozinho ao fim do tempo limite. */
  | { status: "finished"; shift: number | null }
  | { status: "error"; message: string };

/**
 * Ouve o microfone e, em tempo real, estima quantos semitons transpor a cifra (relativo aos acordes escritos).
 * `template` vem de `keyTemplate(songData, writtenKey)`; o palpite é a média do que soou até agora.
 */
export function useKeyDetect(template: number[] | null) {
  const [state, setState] = useState<KeyDetectState>({ status: "idle" });
  const releaseRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    releaseRef.current?.();
    releaseRef.current = null;
    setState({ status: "idle" });
  }, []);

  useEffect(() => () => releaseRef.current?.(), []);

  const start = useCallback(
    async (limitMs?: number) => {
      if (!template || template.every((v) => v === 0)) {
        setState({ status: "error", message: "Esta cifra não tem acordes para comparar." });
        return;
      }
      releaseRef.current?.();
      const avg = new Array<number>(12).fill(0);
      let soundFrames = 0;
      let shift: number | null = null;
      const startedAt = performance.now();
      let lastDecision = startedAt;

      try {
        releaseRef.current = await startMicChroma(({ level, chroma }) => {
          const now = performance.now();
          if (chroma) {
            for (let i = 0; i < 12; i++) avg[i] = avg[i] * DECAY + chroma[i];
            soundFrames++;
          }
          if (now - lastDecision >= DECIDE_MS && soundFrames >= MIN_FRAMES) {
            lastDecision = now;
            const result = bestShift(avg, template);
            if (result.confidence >= MIN_CONFIDENCE) shift = result.shift;
          }
          const remainingMs = limitMs ? Math.max(0, limitMs - (now - startedAt)) : null;
          if (remainingMs === 0) {
            releaseRef.current?.();
            releaseRef.current = null;
            setState({ status: "finished", shift });
            return;
          }
          setState({ status: "listening", level, shift, remainingMs });
        });
        setState({ status: "listening", level: 0, shift: null, remainingMs: limitMs ?? null });
      } catch (err) {
        setState({ status: "error", message: err instanceof Error ? err.message : "Não foi possível ligar o microfone." });
      }
    },
    [template],
  );

  return { state, start, stop };
}
