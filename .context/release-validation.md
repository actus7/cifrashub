# Release candidate validation — `release/advisor-rc1`

> Plan: `plans/020-integration-release-candidate.md` · Executed 2026-11-01
> Environment: WSL Ubuntu 24.04.5 · node v24.18.0 (nvm, matches `.nvmrc` 24) · npm 12.0.2 · Linux-native copy `~/cifrashub-rc`

## Step 1 — Branch + merges

Base: `1e24394` (main). Merge order per plan, all as `git merge --no-edit <branch>`:

| # | Branch | Result |
|---|---|---|
| 1 | `advisor/019-tech-debt-consolidation` | fast-forward, clean |
| 2 | `advisor/002-fix-chord-grammar` | conflict: `package-lock.json` only → took theirs (regenerated in Step 2) |
| 3 | `advisor/004-security-headers` | clean |
| 4 | `advisor/017-setlist-stage-navigation` | conflict: `src/app/api/setlists/[id]/items/route.ts` (imports) → see below |
| 5 | `advisor/013-guest-setlist-migration-safety` | clean |
| 6 | `advisor/018-perf-batch` | conflict: `src/lib/cloud-api.ts` → see below |
| 7 | `advisor/011-better-auth-upgrade-v2` | clean |
| 8 | `advisor/012-docs-and-tooling-truth` | clean |

### Conflict resolutions (both integration seams, no logic changes)

1. **`src/app/api/setlists/[id]/items/route.ts`** (019 × 017): 017 added `normalizeNote`
   and the old `requireUserId` import; 019 deleted `api-auth.ts` and consolidated auth into
   `requireApiUserId` (same signature/behavior). Resolution: kept 019's
   `import { readJsonBody, requireApiUserId } from "@/lib/server/api-route"` plus 017's
   `import { normalizeNote } from "@/lib/setlist-local"`. The merged body already calls
   `requireApiUserId()` (019 shape) and `normalizeNote` (017 feature). Validated by
   typecheck + the setlist integration tests.
2. **`src/lib/cloud-api.ts`** (019 × 018): both sides appended independent exported
   functions (`cloudTouchRecent`/`cloudRemoveRecent` vs `cloudRemoveFolderSongs`) → kept
   both; no overlapping logic.

All 8 branches are ancestors of HEAD (`git merge-base --is-ancestor <branch> HEAD` → exit 0 each).

## Step 2 — Linux lockfile (commit `72648a7`)

Commands (WSL, Linux-native copy, `node 24.18.0`/`npm 12.0.2`):

```
rsync -a --exclude node_modules --exclude .next <worktree>/ ~/cifrashub-rc/
rm -f package-lock.json
npm install --package-lock-only --ignore-scripts --no-audit --no-fund --allow-remote=all   # exit 0
npm ci                                                                                    # exit 0, 791 packages
cp package-lock.json <worktree>/package-lock.json
git commit -m "chore(deps): regenerate lockfile on Linux for release candidate"
```

**Deviation — `--allow-remote=all`**: npm 12 defaults `allow-remote=none`, which aborts
`--package-lock-only` with `EALLOWREMOTE` when Arborist "cracks open" bundled-deps tarballs
by resolved URL (`@tailwindcss/oxide-wasm32-wasm32-wasi` bundles deps). The fetched URLs are
standard `registry.npmjs.org` tarballs from the registry packuments; the flag only affects
this one-shot lockfile generation. `npm ci` needs no flag (matches green CI on main).

**emnapi check deviation**: the plan's exact probe
`grep -c '"node_modules/@emnapi/core"' package-lock.json` returns 0, because npm 12 nests
the entry instead of hoisting it:

```
"node_modules/@emnapi/runtime": { ... }                                        (top level)
"node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/@emnapi/core": { ... }
"node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/@emnapi/runtime": { ... }
"node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/@emnapi/wasi-threads": { ... }
```

The intent (wasm32/@emnapi optional entries present so Linux `npm ci` resolves) is
satisfied: entries exist and `npm ci` exits 0 on Linux with node 24/npm 12 — the same
engine CI uses. Note: even the pre-regeneration lockfile had no top-level
`@emnapi/core` key, so that probe was already stale.

## Step 3 — Full gates on Linux (Linux copy re-synced after Step 2)

| Gate | Command | Exit | Notes |
|---|---|---|---|
| lockfile/`npm ci` | `npm ci` | **0** (19s) | 791 packages |
| lint | `npm run lint` | **0** (6s) | 1 warning (pre-existing from 019): `share-query.ts:9 '_ownerId' assigned but never used` |
| typecheck | `npm run typecheck` | **0** (6s) | |
| test | `npm run test` | **0** (9s) | **28 files, 212 tests passed** (019 alone had 177; +tests come from merged 002/013/017/004) |
| audit | `npm run audit` | **1** | pre-existing — see Blocker |
| drift | `npx drizzle-kit generate --name ci_drift_check` | **0** | "No schema changes, nothing to migrate 😴"; `drizzle/` byte-identical to the worktree (`diff -r`) |
| build | `npm run build` (stub env vars from plan) | **0** (17s) | Next.js 16.4.3 (Turbopack): "✓ Compiled successfully in 8.8s", TypeScript 6.4s, 21 static pages, full route table. The Windows-only build failure does NOT reproduce on Linux — no need for the plain-`main` comparison build. |

Drift note: the plan's `git status --porcelain drizzle/` half cannot run inside the Linux
copy (its rsynced `.git` points to the Windows worktree path); substituted `diff -r`
(identical) plus the worktree's clean `git status drizzle/`. Same evidence, stronger check.

## Blocker (pre-existing, not an integration bug)

`npm run audit` fails with two **high** advisories on `happy-dom@20.14.6` (devDependency,
test-environment for the parser characterization tests, introduced by
`advisor/002-fix-chord-grammar`):

- `GHSA-834v-8h66-3h79` — Incomplete fix for CVE-2026-33943 (range `>=17.0.0 <=21.0.3`)
- `GHSA-c8p4-j97h-3vg8` — SSRF via iframe/link stylesheet (range `<=20.14.6`)

Evidence it is pre-existing: `advisor/002-fix-chord-grammar`'s own lockfile also resolves
`happy-dom-20.14.6.tgz`, and the RC lockfile kept the same version (the regeneration did
not bump it — `^20.14.6` cannot reach the patched 21.x). Both advisories were published
after the branch was validated. Per plan scope this is reported, not fixed. Maintainer
options: (a) add both URLs to `ACCEPTED` in `scripts/audit.cjs` (dev-only exposure, no
patched release in range), or (b) bump to `^21.0.4` (patched, but a major bump of the DOM
the characterization tests pin against — re-run the 002 test suite afterwards).

## WSL diagnostics (for the record)

- The "npm -v hung" symptom: WSL's default `PATH` includes `/mnt/c/nvm4w/nodejs`, whose
  `node` shim cannot exec (`node: not found`); invoking npm from Windows-on-WSL then hangs.
  Fix: load nvm inside WSL (`nvm use 24`) and filter `/mnt/c` out of `PATH` in the scripts.
- WSL clock drifted ~3h after host restarts; file mtimes are untrustworthy. All
  verification above relies on git/content, not timestamps.
- Tool-output capture from `wsl -e` was intermittently truncated mid-run; every gate's
  exit code was re-read from a log file inside WSL, not from the streamed output.

## Cleanup (Step 4)

`~/cifrashub-rc` deleted; all `rc-*.sh` helper scripts and their outputs removed from the
worktree. Worktree is clean (no untracked files, no `node_modules` installed on the Windows
drive). Nothing pushed — local commits only, per plan.

## Audit fix

`happy-dom` bumped `^20.14.6` -> `^21.0.4` (21.0.4 is the lowest version outside both advisory ranges; 21.0.3 is still in GHSA-834v-8h66-3h79). Lockfile regenerated on Linux (WSL, node 24.18.0, npm 12.0.2, `--allow-remote=all` as in Step 2).

| Gate | Exit | Notes |
|---|---|---|
| `npm ci` | 0 | |
| lint | 0 | same 1 pre-existing warning (`share-query.ts`) |
| typecheck | 0 | |
| test | 0 | 28 files, 212 tests passed |
| audit | 0 | |
| drift | 0 | "No schema changes"; `drizzle/` identical to worktree (`diff -rq`) |
| build | 0 | stub env |
