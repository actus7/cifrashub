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
  if (state.inLineComment) {
    if (ch === "\n") state.inLineComment = false;
    return 0;
  }

  if (!state.inBlockComment) return null;
  if (ch === "*" && next === "/") {
    state.inBlockComment = false;
    return 1;
  }
  return 0;
}

function advanceQuotedState(state, sqlText, index, ch, next) {
  if (state.dollarTag) {
    if (sqlText.startsWith(state.dollarTag, index)) {
      const skip = state.dollarTag.length - 1;
      state.dollarTag = null;
      return skip;
    }
    return 0;
  }

  if (state.inSingleQuote) {
    if (ch === "'" && next === "'") return 1;
    if (ch === "'") state.inSingleQuote = false;
    return 0;
  }

  if (state.inDoubleQuote) {
    if (ch === '"' && next === '"') return 1;
    if (ch === '"') state.inDoubleQuote = false;
    return 0;
  }

  return null;
}

function enterSqlState(state, sqlText, index, ch, next) {
  if (ch === "-" && next === "-") {
    state.inLineComment = true;
    return 1;
  }
  if (ch === "/" && next === "*") {
    state.inBlockComment = true;
    return 1;
  }
  if (ch === "'") {
    state.inSingleQuote = true;
    return 0;
  }
  if (ch === '"') {
    state.inDoubleQuote = true;
    return 0;
  }
  if (ch !== "$") return null;

  const tag = readDollarTag(sqlText, index);
  if (!tag) return null;
  state.dollarTag = tag;
  return tag.length - 1;
}

function advanceSqlSplitter(state, sqlText, index) {
  const ch = sqlText[index];
  const next = sqlText[index + 1];
  const commentSkip = advanceCommentState(state, ch, next);
  if (commentSkip !== null) return commentSkip;

  const quotedSkip = advanceQuotedState(state, sqlText, index, ch, next);
  if (quotedSkip !== null) return quotedSkip;

  const enterSkip = enterSqlState(state, sqlText, index, ch, next);
  if (enterSkip !== null) return enterSkip;

  if (ch === ";") pushSqlStatement(state, sqlText, index);
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
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`[migrate] Missing file, skipping: ${fileName}`);
    return;
  }

  const sqlText = fs.readFileSync(filePath, "utf-8");
  const statements = splitSqlStatements(sqlText);

  for (const stmt of statements) {
    try {
      await sql.query(stmt);
    } catch (err) {
      const msg = String(err);
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate key")
      ) {
        console.log(`[migrate] OK (expected): ${msg.slice(0, 120)}`);
      } else {
        throw err;
      }
    }
  }

  console.log(`[migrate] OK: ${fileName}`);
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url || url.includes("placeholder")) {
    console.log("[migrate] Missing DATABASE_URL, skipping migrations.");
    return;
  }

  const phase = process.argv[2] ?? "all";
  const files =
    phase === "all"
      ? [...MIGRATION_PHASES.pre, ...MIGRATION_PHASES.post]
      : MIGRATION_PHASES[phase];

  if (!files) {
    throw new Error(`Invalid migration phase: ${phase}`);
  }

  const sql = neon(url);
  for (const fileName of files) {
    await runMigrationFile(sql, fileName);
  }

  console.log("[migrate] Migrations completed successfully.");
}

main().catch((err) => {
  console.error("[migrate] ERROR:", err);
  process.exit(1);
});
