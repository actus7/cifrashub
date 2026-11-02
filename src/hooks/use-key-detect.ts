"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioContext, ensureResumed } from "@/lib/audio-context";
import { detectToneShift, pitchFromFrame } from "@/lib/key-detect";

const SAMPLE_EVERY_MS = 50;
/** De quanto em quanto tempo o tom é reavaliado. */
const EVALUATE_EVERY_MS = 2_000;
/** Só as alturas recentes contam: se a pessoa muda de tom, a detecção acompanha. */
const WINDOW_MS = 15_000;
/** ~2 s de voz com altura clara antes da primeira decisão. */
const MIN_SAMPLES = 40;
const FFT_SIZE = 2048;

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
 * Escuta a voz até `stop()` (ou até `limitMs`, se informado) e, a cada 2 s, estima quantos semitons transpor a partir do tom escrito.
 * `shift` só muda quando duas leituras seguidas concordam (evita o tom pulando).
 */
export function useKeyDetect(writtenKey: string | undefined) {
  const [state, setState] = useState<KeyDetectState>({ status: "idle" });
  const releaseRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    releaseRef.current?.();
    releaseRef.current = null;
    setState({ status: "idle" });
  }, []);

  useEffect(() => () => releaseRef.current?.(), []);

  const start = useCallback(async (limitMs?: number) => {
    if (!writtenKey) {
      setState({ status: "error", message: "Esta cifra não informa o tom." });
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
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      ctx.close().catch(() => {});
      setState({ status: "error", message: micErrorMessage(err) });
      return;
    }
    ensureResumed(ctx);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(FFT_SIZE);
    const samples: { t: number; f: number }[] = [];
    const startedAt = performance.now();
    let lastEval = startedAt;
    let candidate: number | null = null;
    let shift: number | null = null;

    const timer = setInterval(() => {
      const now = performance.now();
      analyser.getFloatTimeDomainData(buf);
      const f = pitchFromFrame(buf, ctx.sampleRate);
      if (f) samples.push({ t: now, f });
      while (samples.length && samples[0].t < now - WINDOW_MS) samples.shift();

      if (now - lastEval >= EVALUATE_EVERY_MS) {
        lastEval = now;
        const reading = detectToneShift(samples.map((s) => s.f), writtenKey, MIN_SAMPLES);
        if (reading !== null && reading === candidate) shift = reading;
        candidate = reading;
      }

      const remainingMs = limitMs ? Math.max(0, limitMs - (now - startedAt)) : null;
      if (remainingMs === 0) {
        releaseRef.current?.();
        releaseRef.current = null;
        setState({ status: "finished", shift });
        return;
      }
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      setState({ status: "listening", level: Math.min(1, Math.sqrt(sum / buf.length) * 5), shift, remainingMs });
    }, SAMPLE_EVERY_MS);

    releaseRef.current = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    };
    setState({ status: "listening", level: 0, shift: null, remainingMs: limitMs ?? null });
  }, [writtenKey]);

  return { state, start, stop };
}
