"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    /**
     * Em dev: não registar SW e remover registos + caches antigos. Um SW de uma visita
     * anterior (ex.: teste de build de produção) continua servindo chunks antigos via
     * cache-first mesmo depois de unregister() — só apagar o CacheStorage evita isso.
     */
    if (process.env.NODE_ENV !== "production") {
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            for (const r of regs) void r.unregister();
          });
      }
      if ("caches" in window) {
        void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }
      return;
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration failed:", err));
    }
  }, []);

  return null;
}
