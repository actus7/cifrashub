---
name: mcp-tooling
description: Use when choosing between MCP/tools in this project, especially Serena, ai-context PREVC, Context7 docs, Playwright browser automation, Neon database, bash, read/edit/search tools, or workflow setup.
---

# MCP Tooling

Use this skill before non-trivial engineering work in `cifrashub` when tool choice matters.

## Default tool routing

- Use Serena for project-aware semantic code work: activate project, read memories, inspect symbols, find references, and make symbol/regex edits.
- Use file tools (`glob`, `grep`, `read`, `edit`, `write`) for exact files, small targeted reads, and normal edits.
- Use `task` with `explore` for broad codebase discovery when the target files are unknown.
- Use ai-context for `.context` scaffolding, PREVC workflow, plans, agent orchestration, and semantic context maps.
- Use Context7 for current third-party docs. Always resolve the library ID before querying docs unless the user provided `/org/project`.
- Use Playwright only for browser/UI validation, screenshots, console/network inspection, and real page interactions.
- Use Neon only for database/project/auth/data-api operations in Neon.
- Use bash only for terminal commands: package scripts, git inspection, builds, lint, tests, and CLIs. Do not use bash for reading/editing/searching files.

## Project startup

- Serena project: `D:\\projetos\\cifrashub` / `cifrashub`.
- After activating Serena, read `mem:core` first and follow only relevant memory references.
- For this project, prefer Serena symbolic tools over full-file reads when editing TypeScript.

## Safety gates

- Never run destructive Neon actions or destructive SQL without explicit user approval.
- Never commit, amend, push, create PRs, or force git operations unless explicitly requested.
- Never expose secrets from config files in responses. If a secret is found, mention only that a secret exists and recommend moving it to an env var.
- For opencode config changes, validate shape against `https://opencode.ai/config.json` when unsure and tell the user to restart opencode.

## Verification

- For code changes, use `npm run lint` and `npm run build` when feasible.
- There is no `npm run test` script currently; ask for the test command before claiming tests ran.
- For UI behavior, combine build/lint with Playwright checks when a browser-observable flow changed.
