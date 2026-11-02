"use client";

import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Selo "Experimental" para os recursos da assinatura que usam IA/áudio e podem errar. */
export function ExperimentalBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400",
        className,
      )}
      title="Recurso experimental: pode cometer erros."
    >
      <FlaskConical className="size-2.5" aria-hidden /> Experimental
    </span>
  );
}

const STORAGE_PREFIX = "cifrashub:experimental-notice:";

/** Aviso de recurso experimental, uma vez por navegador para cada recurso (sem armazenamento: avisa toda vez). */
export function notifyExperimentalOnce(feature: string, message: string) {
  let seen = false;
  try {
    seen = localStorage.getItem(STORAGE_PREFIX + feature) === "1";
    if (!seen) localStorage.setItem(STORAGE_PREFIX + feature, "1");
  } catch {
    // localStorage indisponível (aba privada etc.): melhor avisar de novo do que não avisar.
  }
  if (!seen) toast.warning("Recurso experimental", { description: message, duration: 9000 });
}
