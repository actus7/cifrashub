---
name: playwright-mcp
description: Use when working with Playwright MCP specifically: browser navigation, accessibility snapshots, element clicks/forms, screenshots, console logs, network requests, and UI regression checks.
---

# Playwright MCP

Use Playwright MCP for browser-observable behavior.

## Flow

- Navigate to the target URL first.
- Capture `browser_snapshot` before clicking or filling; use exact element refs from the snapshot.
- Use `browser_wait_for` for expected text/state changes.
- Use console messages and network requests after reproducing errors.
- Use screenshots for visual evidence, not as the primary way to locate elements.

## Interaction rules

- Prefer accessible roles/names from snapshots.
- Do not use unsafe code execution unless no safe tool can accomplish the task.
- Do not enter real credentials unless user provided test credentials for this task.
- Do not perform destructive UI actions without approval.

## Local development

- Check package scripts before starting any app process.
- Do not launch long-running servers with normal bash unless the user requested it and the workflow is safe.
- If the user provides a localhost URL, use it directly.

## Validation targets

- Confirm expected route/page renders.
- Check critical interactions, form validation, route transitions, error toasts, and loading states.
- Inspect console errors and failed API calls for UI bugs.
- Test responsive behavior by resizing when layout changes matter.

## Cleanup

- Close tabs/pages when finished if no longer needed.
- Report route tested, actions performed, and any console/network failures.
