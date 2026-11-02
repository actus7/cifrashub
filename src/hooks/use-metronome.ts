"use client";

import { useEffect, useRef } from "react";
import { PLAYER_PREF_DEFAULTS } from "@/lib/player-pref-defaults";
import { createAudioContext, ensureResumed } from "@/lib/audio-context";



export function useMetronome(
  active: boolean,
  bpm: number,
  options?: { beatsPerBar?: number },
) {
  const beatsPerBar = options?.beatsPerBar ?? 4;
  const beatRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!active) {
      beatRef.current = 0;
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
      return;
    }

    if (!ctxRef.current) {
      ctxRef.current = createAudioContext();
    }

    const safeBpm = Number.isFinite(bpm) ? Math.min(300, Math.max(20, bpm)) : PLAYER_PREF_DEFAULTS.bpm;
    const msPerBeat = 60000 / safeBpm;
    const interval = setInterval(() => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      try {
        ensureResumed(ctx);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = beatRef.current === 0 ? 1000 : 800;
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } catch {
        /* ignore */
      }

      beatRef.current = (beatRef.current + 1) % beatsPerBar;
    }, msPerBeat);

    return () => {
      clearInterval(interval);
    };
  }, [active, bpm, beatsPerBar]);

  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);
}
