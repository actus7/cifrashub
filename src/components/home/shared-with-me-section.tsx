"use client";

import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLibraryStore } from "@/store/use-library-store";

export function SharedWithMeSection() {
  const router = useRouter();
  const sharedFolders = useLibraryStore((s) => s.sharedFolders);
  const sharedSetlists = useLibraryStore((s) => s.sharedSetlists);

  if (sharedFolders.length === 0 && sharedSetlists.length === 0) return null;

  return (
    <section className="flex flex-col gap-5">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
        <Users className="size-3.5" />
        Compartilhado comigo
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sharedFolders.map((folder) => (
          <SharedItemCard
            key={folder.id}
            title={folder.title}
            ownerName={folder.ownerName}
            fallbackLabel="Pasta compartilhada"
            onClick={() => router.push(`/folder/${folder.id}`)}
          />
        ))}
        {sharedSetlists.map((setlist) => (
          <SharedItemCard
            key={setlist.id}
            title={setlist.title}
            ownerName={setlist.ownerName}
            fallbackLabel="Setlist compartilhada"
            onClick={() => router.push(`/setlist/${setlist.id}`)}
          />
        ))}
      </div>
    </section>
  );
}

function SharedItemCard({
  title,
  ownerName,
  fallbackLabel,
  onClick,
}: {
  title: string;
  ownerName: string | null;
  fallbackLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-muted-foreground"
    >
      <p className="truncate font-semibold text-foreground">{title}</p>
      <p className="truncate text-xs text-muted-foreground">{ownerName ? `de ${ownerName}` : fallbackLabel}</p>
    </button>
  );
}
