# AGENTS.md

## Dev environment tips
- Install dependencies with `npm install`.
- Use `npm run dev` to start the local Next.js development server.
- Use `npm run build` to validate the production Next.js build.
- Store AI-generated workflow artifacts in `.context/`.
- Do not commit real environment files; `.env.local` is ignored and `.env.example` is the safe template.

## Testing instructions
- Execute `npm run test` to run the Vitest suite once.
- Execute `npm run test:watch` while iterating on a failing spec.
- Execute `npm run typecheck` for TypeScript validation.
- Execute `npm run audit` to fail on moderate or higher dependency vulnerabilities.
- Execute `npm run verify` before opening a PR; it runs lint, typecheck, tests, build, and audit.
- Add or update tests alongside parser, sync, API, storage, or domain-rule changes.

## Database instructions
- Edit the schema in `src/db/schema.ts`.
- Prefer `npm run db:generate` to create versioned Drizzle migrations in `drizzle/`.
- Use `npm run db:push` only for controlled local or reviewed environments.
- Do not run database changes against production without explicit human approval.

## PR instructions
- Follow Conventional Commits, for example `feat(song): add stage controls` or `chore(ci): add verification workflow`.
- Include validation evidence from `npm run verify` or list any skipped command with the reason.
- Keep generated migration files committed when schema changes.
- Attach screenshots or short recordings for visible UI behavior changes.

## Repository map
- `src/app/`: Next.js App Router pages, layouts, and API routes.
- `src/components/`: shared UI and feature components.
- `src/hooks/`: reusable client hooks.
- `src/lib/`: domain utilities, parser, storage, API clients, auth helpers, and server helpers.
- `src/db/`: Drizzle database schema and client setup.
- `drizzle/`: versioned Drizzle migrations and metadata.
- `scripts/`: local and deployment automation.
- `public/`: static assets and service worker.
- `.github/workflows/`: CI automation.
- `.context/`: AI context, plans, workflow state, and agent documentation.

## AI Context References
- Documentation index: `.context/docs/README.md`
- Agent playbooks: `.context/agents/README.md`
- Contributor guide: `CONTRIBUTING.md`
