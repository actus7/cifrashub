# Task Completion

- For code changes, run `npm run lint` and `npm run build` when feasible; `npm run build` is the available type/build validation command.
- If DB schema changes are made, also run the appropriate Drizzle flow (`npm run db:push` against intended environment only after user approval/credentials are available).
- No current test script exists in `package.json`; ask user for the desired test command before running tests, despite stale AGENTS.md mentioning Jest.
- Before PR/commit (only when explicitly requested): inspect `git status`, `git diff`, and recent log; never commit secrets or generated env files.
- For Vercel/deploy-impacting changes, ensure `npm run vercel-build` semantics are considered, especially production migration behavior.