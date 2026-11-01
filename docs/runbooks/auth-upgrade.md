# Auth upgrade: better-auth 1.6.25 to 1.7.15

## What changed
- `overrides["better-auth"]`: `1.6.25` to `1.7.15`.
- `overrides["@hono/node-server"]`: `2.0.11` to `2.1.3`.
- `overrides.minimatch`: `10.2.5` to `11.0.1`.
- `scripts/patch-better-auth.cjs` now exits 1 when no better-auth `dist/client/plugins/index.mjs` is found under any known root (it used to skip silently).

## Why the override goes beyond what `@neondatabase/auth` declares
`@neondatabase/auth` pins `better-auth` to exactly 1.7.6, which is vulnerable to
GHSA-965c-763c-88jm (critical) and GHSA-r4xp-prcw-77qf (high); both are fixed in 1.7.7.
`@better-auth/api-key@1.7.12` also requires `better-auth ^1.7.12`. The override forces every copy
onto 1.7.15. Remove it once `@neondatabase/auth` ships a dependency on better-auth >= 1.7.7.

## Why the postinstall patch stays
Upstream `better-auth/client/plugins` does not export `apiKeyClient`, which the Neon auth UI
imports. The patch injects a stub export. Drop it once upstream (or Neon) exports it.

## Lockfile
package-lock.json must be regenerated from scratch on Linux (rm package-lock.json && npm install --package-lock-only) — Windows/partial regeneration drops @emnapi wasm32 entries

## Manual smoke checklist (required on a preview deployment before merging)
Automated checks (typecheck, lint, tests, build, audit) cannot verify login against Neon Auth.
- [ ] Sign up with a new test user
- [ ] Sign in
- [ ] Sign out
- [ ] Session persists across a page reload
- [ ] Account page loads
- [ ] Delete the test account
