---
name: ai-context-mcp
description: Use when working with ai-context MCP, .context scaffolding, PREVC workflow, plans, agent orchestration, semantic context maps, skills, docs, or context sync.
---

# ai-context MCP

Use ai-context for structured project context and PREVC workflows.

## Repository setup

- Always pass `repoPath: D:\\projetos\\cifrashub` on the first context call, usually `context check`.
- If `.context` is missing and the task is non-trivial, initialize it before workflow setup.
- After initializing scaffolding, fill relevant scaffold files before relying on them.

## PREVC workflow

- Use workflow init for non-trivial features/fixes.
- Scale guidance:
  - QUICK: tiny/single-file changes, Execute + Verify only.
  - SMALL: simple feature, Plan + Execute + Verify.
  - MEDIUM: design decisions, Plan + Review + Execute + Verify.
  - LARGE: security/compliance/systems, full Plan + Review + Execute + Verify + Complete.
- Respect gates unless user explicitly approves bypass/autonomous mode.
- Link plans when a plan exists and update phase/step status as work progresses.

## Planning and agents

- Use `agent orchestrate` or `getSequence` when multiple specialized roles would help.
- Use plan tools for decisions, phase status, step outputs, and markdown sync.
- Use skills tools to inspect or scaffold ai-context skills, not opencode skills.

## Semantic context

- Use `buildSemantic` for focused context around files or documentation/playbook generation.
- Use `getMap` for stack, structure, architecture, symbols, public API, dependencies, or stats.
- Keep generated artifacts inside `.context/`.

## Boundaries

- ai-context is for workflow/context, not direct source edits.
- Use Serena or file edit tools for actual code changes.
