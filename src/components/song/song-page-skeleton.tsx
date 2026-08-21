import { Skeleton } from "@/components/ui/skeleton";

export function SongPageSkeleton() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background pb-20 sm:pb-16">
      {/* ─── Mock Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="hidden sm:block">
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md hidden sm:block" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md hidden sm:block" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6 md:px-8">
        <div className="mb-10 sm:hidden">
          <Skeleton className="h-10 w-3/4 mb-3" />
          <Skeleton className="h-6 w-1/2 mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>

        <div className="hidden sm:block mb-10">
          <Skeleton className="h-12 w-1/2 mb-3" />
          <Skeleton className="h-7 w-1/3 mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>

        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </main>

      {/* ─── Mock Mobile Toolbar ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 z-40 w-full border-t bg-background/95 p-2 backdrop-blur sm:hidden">
        <div className="flex items-center justify-around">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
