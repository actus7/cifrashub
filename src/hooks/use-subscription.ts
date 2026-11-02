"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";

/** true quando o usuário logado tem assinatura ativa (verificada no servidor). */
export function useIsSubscriber(): boolean {
  const { status, data } = useSession();
  const userId = data?.user.id;
  const [isSubscriber, setIsSubscriber] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    const controller = new AbortController();
    fetch("/api/account", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { isSubscriber: false }))
      .then((body: { isSubscriber?: boolean }) => setIsSubscriber(Boolean(body.isSubscriber)))
      .catch(() => {
        // ponytail: falha de rede = recurso premium oculto; o servidor revalida em toda rota premium.
      });
    return () => controller.abort();
  }, [status, userId]);

  return status === "authenticated" && isSubscriber;
}
