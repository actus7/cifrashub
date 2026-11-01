# Database migrations

## Day-to-day flow

1. Edit `src/db/schema.ts`.
2. Run `npm run db:generate` (needs no database connection).
3. Review and commit the new `drizzle/NNNN_*.sql` and `drizzle/meta/*` files.
4. CI (`Migrations in sync with schema`) fails if the schema changed without a committed migration.

### neon_auth."user" is not ours

`schema.ts` declares `neon_auth."user"` (via `pgSchema("neon_auth")`) for read-only joins. The generator emits a
`CREATE TABLE "neon_auth"."user"` for it, but Neon Auth owns that table. After each `db:generate`, delete that
statement from the generated `.sql` by hand (keep the snapshot JSON as generated) and add the header comment used in
`drizzle/0002_*.sql`. Only the first migration that introduces it contains the statement.

## What production does today

`npm run vercel-build` (Production only) runs, in order:

1. `node scripts/migrate.cjs pre`
2. `drizzle-kit push --verbose` (no `--force`)
3. `node scripts/migrate.cjs post`

Without `--force`, destructive diffs prompt for confirmation. The push runs with stdin closed and a 5-minute timeout,
so the prompt fails and the build aborts instead of silently dropping data (fail-closed).

## Moving production to `drizzle-kit migrate` (requires explicit human approval)

Production tables already exist (created by `push`), so `drizzle-kit migrate` would try to re-create them. A one-time
baseline is needed. Every step below requires explicit human approval; none is automated:

1. Back up or branch the Neon database.
2. Create the `drizzle.__drizzle_migrations` table and insert one row per migration 0000-0002, with the hash and
   `when` (`created_at`) values derived from `drizzle/meta/_journal.json` and the migration SQL files.
3. Replace `db:push:ci` with `drizzle-kit migrate` in `scripts/vercel-build.cjs`.
4. Check `scripts/migrate.cjs pre/post` for overlap with the versioned migrations.
