"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useSetlistNavigation } from "@/hooks/use-setlist-navigation";

type Nav = NonNullable<ReturnType<typeof useSetlistNavigation>>;

export function SetlistNavBar({ nav }: { nav: Nav }) {
  return (
    <nav
      aria-label={`Setlist ${nav.title}`}
      data-scroll-inset="bottom"
      className="no-print fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-2 border-t bg-background/95 px-3 py-2 backdrop-blur"
    >
      <Button variant="ghost" size="sm" disabled={!nav.prev} onClick={() => nav.go(nav.prev)}>
        <ChevronLeft className="size-4" /> Anterior
      </Button>
      <span className="min-w-0 truncate text-sm text-muted-foreground">
        {nav.title} · {nav.index}/{nav.total}
      </span>
      <Button variant="ghost" size="sm" disabled={!nav.next} onClick={() => nav.go(nav.next)}>
        Próxima <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
