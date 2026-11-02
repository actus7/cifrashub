"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StageResponse, StageUpdate } from "@/lib/stage";

/** Músicos consultam o palco a cada 1 s. */
const POLL_MS = 1_000;
/** O dono publica no máximo 1 vez por segundo (a última mudança sempre chega). */
const PUBLISH_MIN_MS = 1_000;

/**
 * Único ponto de transporte do modo palco.
 * ponytail: polling de 1 s; trocar por Neon Realtime (live query em setlist_stage) aqui quando a replicação
 * lógica estiver ligada no projeto — o resto do app só usa { data, publish }.
 */
export function useStage(setlistId: string | null, { poll }: { poll: boolean }) {
  const [data, setData] = useState<StageResponse | null>(null);
  const pending = useRef<StageUpdate | null>(null);
  const lastSent = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!setlistId) return;
    try {
      const res = await fetch(`/api/setlists/${encodeURIComponent(setlistId)}/stage`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as StageResponse);
    } catch {
      // ponytail: rede instável no palco; a próxima consulta tenta de novo.
    }
  }, [setlistId]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const id = poll ? setInterval(() => void load(), POLL_MS) : undefined;
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load, poll]);

  const flush = useCallback(async () => {
    timer.current = null;
    const update = pending.current;
    if (!update || !setlistId) return;
    pending.current = null;
    lastSent.current = Date.now();
    try {
      await fetch(`/api/setlists/${encodeURIComponent(setlistId)}/stage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
    } catch {
      pending.current ??= update;
    }
  }, [setlistId]);

  const publish = useCallback(
    (update: StageUpdate) => {
      pending.current = update;
      if (timer.current) return;
      const wait = Math.max(0, lastSent.current + PUBLISH_MIN_MS - Date.now());
      timer.current = setTimeout(() => void flush(), wait);
    },
    [flush],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { data, publish, reload: load };
}
