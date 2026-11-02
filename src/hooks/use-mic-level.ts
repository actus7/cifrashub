"use client";

import { useEffect, useState } from "react";
import { createAudioContext, ensureResumed } from "@/lib/audio-context";

/** Atualizações por segundo do medidor (suficiente para a animação, sem re-render a cada quadro). */
const UPDATE_MS = 80;

/**
 * Nível (0–1) do microfone enquanto `active`. O reconhecimento de voz do navegador não informa volume,
 * então abre um segundo fluxo só para medir (como o medidor do kit Jev). Sem permissão, fica em 0.
 */
export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let release = () => {};
    void (async () => {
      const ctx = createAudioContext();
      if (!ctx || !navigator.mediaDevices?.getUserMedia) return;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        ctx.close().catch(() => {});
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
        return;
      }
      ensureResumed(ctx);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const id = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 6));
      }, UPDATE_MS);
      release = () => {
        clearInterval(id);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
      };
    })();
    return () => {
      stopped = true;
      release();
      setLevel(0);
    };
  }, [active]);

  return active ? level : 0;
}
