"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioContext, ensureResumed, SOUND_LEVEL } from "@/lib/audio-context";
import { bestShift, spectrumChroma } from "@/lib/key-detect";

/** FFT grande = resolução de ~3 Hz, suficiente para separar semitons a partir de ~100 Hz. */
const FFT_SIZE = 16_384;
const FRAME_MS = 100;
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

function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "O navegador bloqueou o microfone. Libere o acesso no cadeado da barra de endereço.";
  if (name === "NotFoundError") return "Nenhum microfone encontrado.";
  return "Não foi possível ligar o microfone.";
}

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
      const ctx = createAudioContext();
      if (!ctx || !navigator.mediaDevices?.getUserMedia) {
        setState({ status: "error", message: "Este navegador não permite usar o microfone." });
        return;
      }
      let stream: MediaStream;
      try {
        // Sem processamento de voz: ele corta notas sustentadas de instrumento e distorce o espectro.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (err) {
        ctx.close().catch(() => {});
        setState({ status: "error", message: micErrorMessage(err) });
        return;
      }
      ensureResumed(ctx);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const spectrum = new Float32Array(analyser.frequencyBinCount);
      const wave = new Float32Array(2048);
      const avg = new Array<number>(12).fill(0);
      let tuning = 0;
      let soundFrames = 0;
      let shift: number | null = null;
      const startedAt = performance.now();
      let lastDecision = startedAt;

      const timer = setInterval(() => {
        const now = performance.now();
        analyser.getFloatTimeDomainData(wave);
        let sum = 0;
        for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
        const level = Math.min(1, Math.sqrt(sum / wave.length) * 6);

        if (level >= SOUND_LEVEL) {
          analyser.getFloatFrequencyData(spectrum);
          const frame = spectrumChroma(spectrum, ctx.sampleRate, FFT_SIZE, tuning);
          if (frame.energy > 0) {
            // Afinação também segue a média, devagar (um quadro ruidoso não desloca a grade).
            tuning += (frame.tuningCents - tuning) * 0.05;
            const total = frame.chroma.reduce((s, x) => s + x, 0);
            for (let i = 0; i < 12; i++) avg[i] = avg[i] * DECAY + frame.chroma[i] / total;
            soundFrames++;
          }
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
      }, FRAME_MS);

      releaseRef.current = () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
      };
      setState({ status: "listening", level: 0, shift: null, remainingMs: limitMs ?? null });
    },
    [template],
  );

  return { state, start, stop };
}
