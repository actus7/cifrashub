---
name: browser-mcp
description: Use when validating UI behavior with Playwright MCP, browser automation, screenshots, accessibility snapshots, console logs, network requests, navigation, forms, or visual checks.
---

# Browser MCP

Use this skill for Playwright/browser MCP work in this project.

## When to use

- Validate user-visible UI flows after frontend changes.
- Inspect console errors, failed network calls, accessibility tree, screenshots, form behavior, routing, and responsive layout.
- Reproduce browser-only bugs.

## Tool order

- Navigate to the target URL, then use `browser_snapshot` for actionable element references.
- Prefer snapshots over screenshots for locating and interacting with elements.
- Use screenshots only for visual evidence or layout checks.
- Use console and network tools after reproducing the issue.
- Use `browser_wait_for` instead of arbitrary repeated actions when waiting for UI state.

## Local app

- If a local server is required, inspect package scripts first.
- Do not start long-running dev servers directly unless the user requested it or a background-safe workflow is available.
- Prefer validating against an already-running local URL when the user provides one.

## Safety

- Do not enter real credentials unless the user explicitly provides test credentials for this task.
- Do not perform destructive production actions through the UI without approval.
- Close browser pages when validation is complete if they are no longer needed.

## Reporting

- Report concise findings: route tested, key user actions, console/network failures, and whether the expected UI state appeared.
- Reference source files with `file_path:line_number` only when connecting UI behavior to code.
