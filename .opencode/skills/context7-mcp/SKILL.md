---
name: context7-mcp
description: Use when fetching current external library documentation with Context7, including Next.js, React, Drizzle, Neon SDKs, Tailwind, shadcn, Zustand, or other package APIs.
---

# Context7 MCP

Use Context7 for up-to-date third-party documentation and examples.

## Required flow

- First call resolve-library-id with the official library name unless the user gave a Context7 ID like `/org/project`.
- Choose the best match by exact name, source reputation, snippet count, benchmark score, and relevance.
- Then call query-docs with the exact library ID and a specific task-focused question.
- Do not call Context7 docs more than three times for one question.

## When to use

- Confirm current API shapes, framework behavior, migration notes, or examples.
- Use for dependencies in this project such as Next.js, React, Drizzle, Neon, Tailwind, shadcn, Zustand, Better Auth, or Playwright when local code is insufficient.
- Use before introducing unfamiliar APIs or patterns.

## When not to use

- Do not use for this project’s own code; use Serena/search/read tools instead.
- Do not send secrets, proprietary code, credentials, or personal data in queries.
- Do not use for Neon platform docs when Neon MCP docs tools are more direct.

## Reporting

- Summarize the relevant doc finding and apply it to the task.
- Prefer concise implementation guidance over pasted docs.
