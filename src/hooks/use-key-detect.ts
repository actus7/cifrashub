"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioContext, ensureResumed } from "@/lib/audio-context";
import { detectToneShift, pitchFromFrame } from "@/lib/key-detect";

/** Tempo de escuta antes de decidir o tom. */
export const KEY_DETECT_MS = 12_000;
const SAMPLE_EVERY_MS = 50;
const FFT_SIZE = 2048;

export type KeyDetectState =
  | { status: "idle" }
  | { status: "listening"; remainingMs: number; level: number }
  | { status: "done"; shift: number }
  | { status: "error"; message: string };

function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "O navegador bloqueou o microfone. Libere o acesso no cadeado da barra de endereço.";
  if (name === "NotFoundError") return "Nenhum microfone encontrado.";
  return "Não foi possível ligar o microfone.";
}

/** Escuta a voz por KEY_DETECT_MS e devolve quantos semitons transpor a partir do tom escrito. */
export function useKeyDetect(writtenKey: string | undefined) {
  const [state, setState] = useState<KeyDetectState>({ status: "idle" });
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (!writtenKey) {
      setState({ status: "error", message: "Esta cifra não informa o tom." });
      return;
    }
    stop();
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
    const freqs: number[] = [];
    const startedAt = performance.now();

    const release = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    };

    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      const f = pitchFromFrame(buf, ctx.sampleRate);
      if (f) freqs.push(f);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const remainingMs = Math.max(0, KEY_DETECT_MS - (performance.now() - startedAt));
      if (remainingMs > 0) {
        setState({ status: "listening", remainingMs, level: Math.min(1, Math.sqrt(sum / buf.length) * 5) });
        return;
      }
      stop();
      const shift = detectToneShift(freqs, writtenKey);
      setState(
        shift === null
          ? { status: "error", message: "Não deu para ouvir a voz. Cante mais perto do microfone e tente de novo." }
          : { status: "done", shift },
      );
    }, SAMPLE_EVERY_MS);

    stopRef.current = release;
    setState({ status: "listening", remainingMs: KEY_DETECT_MS, level: 0 });
  }, [writtenKey, stop]);

  const cancel = useCallback(() => {
    stop();
    setState({ status: "idle" });
  }, [stop]);

  return { state, start, cancel };
}
