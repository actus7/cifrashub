/**
 * Runs SQL migrations via @neondatabase/serverless.
 *
 * Usage:
 *   node scripts/migrate.cjs       # all migrations
 *   node scripts/migrate.cjs pre   # before drizzle-kit push
 *   node scripts/migrate.cjs post  # after drizzle-kit push
 *
 * Requires DATABASE_URL or DATABASE_URL_UNPOOLED.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { neon } = require("@neondatabase/serverless");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const MIGRATION_PHASES = {
  pre: ["migrate-user-song-arrangement.sql"],
  post: ["add-user-fk-cascade.sql"],
};

function createSqlSplitState() {
  return {
    statements: [],
    start: 0,
    inSingleQuote: false,
    inDoubleQuote: false,
    inLineComment: false,
    inBlockComment: false,
    dollarTag: null,
  };
}

function hasSqlContent(statement) {
  return statement.replace(/^\s*--.*$/gm, "").trim().length > 0;
}

function pushSqlStatement(state, sqlText, end) {
  const statement = sqlText.slice(state.start, end).trim();
  if (hasSqlContent(statement)) state.statements.push(statement);
  state.start = end + 1;
}

function readDollarTag(sqlText, index) {
  return sqlText.slice(index).match(/^\$[A-Za-z0-9_]*\$/)?.[0] ?? null;
}

function advanceCommentState(state, ch, next) {
  if (state.inLineComment) return advanceLineComment(state, ch);
  if (state.inBlockComment) return advanceBlockComment(state, ch, next);
  return null;
}

function advanceLineComment(state, ch) {
  if (ch === "\n") state.inLineComment = false;
  return 0;
}

function advanceBlockComment(state, ch, next) {
  if (ch !== "*" || next !== "/") return 0;
  state.inBlockComment = false;
  return 1;
}

function advanceQuotedState(state, sqlText, index, ch, next) {
  if (state.dollarTag) return advanceDollarQuote(state, sqlText, index);
  if (state.inSingleQuote) return advanceSingleQuote(state, ch, next);
  if (state.inDoubleQuote) return advanceDoubleQuote(state, ch, next);
  return null;
}

function advanceDollarQuote(state, sqlText, index) {
  if (!sqlText.startsWith(state.dollarTag, index)) return 0;
  const skip = state.dollarTag.length - 1;
  state.dollarTag = null;
  return skip;
}

function advanceSingleQuote(state, ch, next) {
  if (ch === "'" && next === "'") return 1;
  if (ch === "'") state.inSingleQuote = false;
  return 0;
}

function advanceDoubleQuote(state, ch, next) {
  if (ch === '"' && next === '"') return 1;
  if (ch === '"') state.inDoubleQuote = false;
  return 0;
}

function enterSqlState(state, sqlText, index, ch, next) {
  const commentSkip = enterCommentState(state, ch, next);
  if (commentSkip !== null) return commentSkip;

  const quoteSkip = enterQuoteState(state, ch);
  if (quoteSkip !== null) return quoteSkip;

  return enterDollarQuoteState(state, sqlText, index, ch);
}

function enterCommentState(state, ch, next) {
  return enterLineComment(state, ch, next) ?? enterBlockComment(state, ch, next);
}

function enterLineComment(state, ch, next) {
  if (ch !== "-" || next !== "-") return null;
  state.inLineComment = true;
  return 1;
}

function enterBlockComment(state, ch, next) {
  if (ch !== "/" || next !== "*") return null;
  state.inBlockComment = true;
  return 1;
}

function enterQuoteState(state, ch) {
  if (ch === "'") {
    state.inSingleQuote = true;
    return 0;
  }
  if (ch === '"') {
    state.inDoubleQuote = true;
    return 0;
  }
  return null;
}

function enterDollarQuoteState(state, sqlText, index, ch) {
  if (ch !== "$") return null;
  const tag = readDollarTag(sqlText, index);
  if (!tag) return null;
  state.dollarTag = tag;
  return tag.length - 1;
}

function advanceSqlSplitter(state, sqlText, index) {
  const advance = sqlSplitterAdvance(state, sqlText, index);
  if (advance !== null) return advance;
  return handleSqlSeparator(state, sqlText, index);
}

function sqlSplitterAdvance(state, sqlText, index) {
  const ch = sqlText[index];
  const next = sqlText[index + 1];
  return (
    advanceCommentState(state, ch, next) ??
    advanceQuotedState(state, sqlText, index, ch, next) ??
    enterSqlState(state, sqlText, index, ch, next)
  );
}

function handleSqlSeparator(state, sqlText, index) {
  if (sqlText[index] === ";") pushSqlStatement(state, sqlText, index);
  return 0;
}

function splitSqlStatements(sqlText) {
  const state = createSqlSplitState();

  for (let i = 0; i < sqlText.length; i++) {
    i += advanceSqlSplitter(state, sqlText, i);
  }

  pushSqlStatement(state, sqlText, sqlText.length);
  return state.statements;
}

async function runMigrationFile(sql, fileName) {
  const statements = migrationStatements(fileName);
  if (!statements) return;

  for (const stmt of statements) {
    await runMigrationStatement(sql, stmt);
  }

  console.log(`[migrate] OK: ${fileName}`);
}

function migrationStatements(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`[migrate] Missing file, skipping: ${fileName}`);
    return null;
  }

  return splitSqlStatements(fs.readFileSync(filePath, "utf-8"));
}

async function runMigrationStatement(sql, stmt) {
  try {
    await sql.query(stmt);
  } catch (err) {
    handleMigrationError(err);
  }
}

function handleMigrationError(err) {
  const msg = String(err);
  if (isExpectedMigrationError(msg)) {
    console.log(`[migrate] OK (expected): ${msg.slice(0, 120)}`);
    return;
  }
  throw err;
}

function isExpectedMigrationError(msg) {
  return msg.includes("already exists") || msg.includes("duplicate key");
}

function resolveMigrationUrl() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url || url.includes("placeholder")) return null;
  return url;
}

function resolveMigrationFiles(phase) {
  if (phase === "all") return [...MIGRATION_PHASES.pre, ...MIGRATION_PHASES.post];
  const files = MIGRATION_PHASES[phase];
  if (!files) throw new Error(`Invalid migration phase: ${phase}`);
  return files;
}

async function runMigrations(sql, files) {
  for (const fileName of files) {
    await runMigrationFile(sql, fileName);
  }
}

async function main() {
  const url = resolveMigrationUrl();
  if (!url) {
    console.log("[migrate] Missing DATABASE_URL, skipping migrations.");
    return;
  }

  const files = resolveMigrationFiles(process.argv[2] ?? "all");
  const sql = neon(url);
  await runMigrations(sql, files);
  console.log("[migrate] Migrations completed successfully.");
}

main().catch((err) => {
  console.error("[migrate] ERROR:", err);
  process.exit(1);
});
