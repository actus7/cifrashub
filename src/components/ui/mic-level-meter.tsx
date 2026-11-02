import { SOUND_LEVEL } from "@/lib/audio-context";
import { cn } from "@/lib/utils";

/**
 * Medidor de volume para colocar dentro de um botão `relative overflow-hidden`:
 * o fundo enche com o nível e a borda pulsa quando há som. `tone` = cor sobre fundo claro (ghost) ou escuro (ativo).
 */
export function MicLevelMeter({ level, tone = "onPrimary" }: { level: number; tone?: "onPrimary" | "onGhost" }) {
  const hearing = level >= SOUND_LEVEL;
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 transition-[height] duration-100 ease-out",
          tone === "onPrimary" ? "bg-primary-foreground/30" : "bg-primary/25",
        )}
        style={{ height: `${Math.round(level * 100)}%` }}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-inset transition-opacity duration-150",
          tone === "onPrimary" ? "ring-primary-foreground/70" : "ring-primary/70",
          hearing ? "animate-pulse opacity-100" : "opacity-0",
        )}
      />
      <span className="sr-only">{hearing ? "Captando som" : "Sem som"}</span>
    </>
  );
}
