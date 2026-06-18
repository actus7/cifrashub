---
name: serena-mcp
description: Use when working with Serena MCP in this project: semantic code navigation, project activation, memories, symbols, references, diagnostics, and precise code edits.
---

# Serena MCP

Use Serena as the primary MCP for codebase-aware TypeScript work in `cifrashub`.

## Startup

- Activate project `D:\\projetos\\cifrashub` or `cifrashub` before using Serena tools.
- Read Serena initial instructions once per session if not already read.
- Read `mem:core` first, then follow only relevant memory references.
- Use memories for durable project knowledge, not task-local notes.

## Navigation

- Prefer `get_symbols_overview` before reading large source files.
- Use `find_symbol` with `include_body=false` and `depth=1` to inspect symbol shape.
- Use `find_symbol` with `include_body=true` only for symbols that must be understood or edited.
- Use `find_referencing_symbols` before non-backward-compatible edits.
- Use `search_for_pattern` when symbol names or locations are unknown.

## Editing

- Use `replace_symbol_body` only after retrieving the symbol body.
- Use `replace_content` for smaller in-symbol edits.
- Use `insert_before_symbol` / `insert_after_symbol` for adding imports or top-level code.
- Keep edits compatible with project conventions from `mem:conventions`.
- Do not add comments unless explicitly requested.

## Validation

- Use diagnostics for files touched when useful.
- For code changes, run `npm run lint` and `npm run build` when feasible.
- There is no current `npm run test`; ask for test command if needed.
