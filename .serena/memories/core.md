# Core

- CifrasHub: Next.js App Router web app for organizing/viewing chord sheets, with Cifra Club client-side fetching, cloud sync, PWA/offline, folders, setlists, metronome, stage mode, sharing, YouTube association.
- Source roots: `src/app` routes/API, `src/components` UI/features, `src/lib` domain/client utilities, `src/lib/server` server-side API helpers/queries, `src/db` Drizzle schema/client, `src/hooks` React hooks, `src/store` Zustand state.
- Route domains under `src/app`: account, api, artist, auth, editar, folder, short share `s`, setlist, song. Metadata/layout in `src/app/layout.tsx`; homepage route in `src/app/page.tsx`.
- API routes are colocated under `src/app/api/**/route.ts`; handlers export HTTP verbs. Auth handler is `src/app/api/auth/[...path]/route.ts` via Neon Auth.
- Core client views: home in `src/components/home/home-view.tsx`; song player/view composition in `src/components/song/song-view.tsx`.
- Shared domain types live in `src/lib/types.ts`; parser/Cifra Club HTML extraction in `src/lib/parser.ts`; browser persistence in `src/lib/storage.ts`; cloud HTTP wrappers in `src/lib/cloud-api.ts`.
- State stores: `src/store/use-library-store.ts` for folders/recentes/setlists load state; `src/store/use-player-store.ts` for song/player UI controls.
- Read for stack/commands/conventions: `mem:tech_stack`, `mem:suggested_commands`, `mem:conventions`, `mem:task_completion`.