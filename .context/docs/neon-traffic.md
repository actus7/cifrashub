# Neon traffic and connection runbook

## Runtime architecture

- Application queries use `@neondatabase/serverless` in HTTP mode through the
  singleton exported by `src/db/index.ts`.
- `DATABASE_URL` is the pooled Neon URL (hostname contains `-pooler`) and is the
  only connection string allowed in application runtime code.
- `DATABASE_URL_UNPOOLED` is reserved for Drizzle and migration scripts.
- `attachDatabasePool` is not used because there is no TCP/WebSocket `Pool` to
  attach; Neon HTTP connection caching is managed server-side.

## Traffic controls

- Cloud state is loaded once after authentication.
- A refresh runs when the tab regains focus, the browser returns online, the
  page becomes visible, or another tab emits the per-user storage signal.
- Do not reintroduce interval polling for full library snapshots. The old
  15-second loop made three API requests and repeatedly transferred every
  stored `song_data` value even when nothing changed.
- `GET /api/sync` returns folders and recent songs together so the database
  does not read the full `user_song` table twice for a single refresh.
- Public cifra HTML responses have a one-day CDN TTL and one-week
  stale-while-revalidate window.

## Deployment checks

1. In Vercel Production, confirm `DATABASE_URL` uses a Neon hostname ending in
   `-pooler` before the region suffix.
2. Confirm `DATABASE_URL_UNPOOLED` points to the direct endpoint and is not used
   by any file under `src/`.
3. Keep Preview and Development attached to their intended Neon branches; all
   branches in a project share the project's transfer allowance.
4. After deployment, compare Pooler client connections and network transfer
   with the same time range used before the change. Idle open tabs should no
   longer create a request burst every 15 seconds.

## Regression search

Run this before shipping database-access changes:

```bash
rg -n 'new Pool|new Client|DATABASE_URL_UNPOOLED' src
rg -n 'setInterval' src/components/providers src/lib/cloud-*.ts
```

Expected result: no pool/client constructors, no runtime use of
`DATABASE_URL_UNPOOLED`, and no interval-based database synchronization.
