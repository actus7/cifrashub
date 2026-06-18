---
name: neon-mcp
description: Use when working with Neon Postgres, Neon Auth, Neon Data API, database schemas, migrations, query tuning, connection strings, branches, slow queries, or SQL execution.
---

# Neon MCP

Use this skill for any Neon database, auth, Data API, branch, migration, or SQL task.

## Read-only first

- Prefer read-only inspection tools before writes: list projects, describe project/branch/table, list tables, explain SQL, list slow queries.
- Use `databaseName` explicitly when known; default to `neondb` only when it is not specified.
- For table details use `describe_table_schema`; for table names use `get_database_tables`; for object trees use `describe_branch`.

## Migration workflow

- Prefer temporary-branch workflows for schema changes.
- After `prepare_database_migration`, verify on the temporary branch with `run_sql` before asking to apply.
- Ask for explicit approval before `complete_database_migration`.
- Include migration ID, temporary branch name, temporary branch ID, and migration result when reporting a prepared migration.
- For schema diffs, review tables/views/indexes/constraints/policies/extensions/schemas/sequences/roles/privileges and propose zero-downtime SQL.

## Query tuning workflow

- Use `prepare_query_tuning` for performance tuning.
- Apply suggested DDL only to the temporary branch first, then rerun `explain_sql_statement` on that branch.
- Complete or discard with `complete_query_tuning`; do not use database migration tools for query tuning changes.

## SQL safety

- Never run destructive SQL autonomously: DROP, DELETE, TRUNCATE, or broad UPDATE.
- Ask approval before schema-changing SQL or destructive branch/project operations.
- Prefer idempotent SQL with `IF EXISTS` / `IF NOT EXISTS` where appropriate.
- Prefer zero-downtime patterns: concurrent indexes, NOT VALID constraints followed by validation, nullable-first column additions for volatile defaults.

## Secrets

- Do not print connection strings, API tokens, OAuth secrets, SMTP passwords, or auth client secrets.
- If config contains literal secrets, recommend replacing them with `{env:VAR}` in opencode config.
