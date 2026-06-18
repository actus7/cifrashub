# Conventions

- Use App Router route files under `src/app/**`; API endpoints export HTTP verb functions from `route.ts`.
- Prefer alias imports with `@/*` for source paths.
- Keep shared domain interfaces/types in `src/lib/types.ts`; route/server data conversions belong in `src/lib/server/*`.
- Client persistent library data is normalized through `src/lib/storage.ts`; preserve legacy-shape handling when changing stored folder/setlist/song data.
- Cloud API client wrappers live in `src/lib/cloud-api.ts`; keep request de-dup/error handling centralized there instead of scattering fetch logic.
- Drizzle schema is centralized in `src/db/schema.ts`; DB connection in `src/db/index.ts`; Neon unpooled URL is preferred for schema pushes.
- shadcn/ui conventions from `components.json`: components under `src/components`, reusable primitives under `src/components/ui`, utils alias `@/lib/utils`, hooks alias `@/hooks`, lucide icons.
- Avoid adding comments unless explicitly requested. Match existing component decomposition style: small local functions/components within feature files where already used.