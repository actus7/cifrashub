/**
 * Build na Vercel: em Production, aplica migrações e schema Drizzle antes do Next.
 * Em Preview ou sem VERCEL_ENV, só roda `next build` (evita push no DB de prod em previews).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");

function isDirectNeonUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname.endsWith(".neon.tech") && !hostname.split(".")[0].endsWith("-pooler");
  } catch {
    return false;
  }
}

if (process.env.VERCEL_ENV === "production") {
  const runtimeDbUrl = process.env.DATABASE_URL;
  const migrationDbUrl = process.env.DATABASE_URL_UNPOOLED;
  if (!runtimeDbUrl || !migrationDbUrl) {
    console.error(
      "\n[vercel-build] ERROR: DATABASE_URL and DATABASE_URL_UNPOOLED are required.\n" +
        "Configure it in Vercel → Settings → Environment Variables before deploying to production.\n" +
        "Use the pooled (-pooler) URL at runtime and reserve the direct URL for migrations.\n",
    );
    process.exit(1);
  }

  if (isDirectNeonUrl(runtimeDbUrl)) {
    console.error(
      "\n[vercel-build] ERROR: DATABASE_URL points to a direct Neon endpoint.\n" +
        "Use the pooled hostname containing -pooler for the application runtime.\n" +
        "Keep the direct connection only in DATABASE_URL_UNPOOLED.\n",
    );
    process.exit(1);
  }

  const neonAuthBaseUrl = process.env.NEON_AUTH_BASE_URL || process.env.NEON_AUTH_URL;
  const neonAuthCookieSecret =
    process.env.NEON_AUTH_COOKIE_SECRET || process.env.AUTH_COOKIE_SECRET;

  const missing = [];
  if (!neonAuthBaseUrl) missing.push("NEON_AUTH_BASE_URL (ou NEON_AUTH_URL)");
  if (!neonAuthCookieSecret)
    missing.push("NEON_AUTH_COOKIE_SECRET (ou AUTH_COOKIE_SECRET)");

  if (missing.length > 0) {
    console.error(
      `\n[vercel-build] ERROR: Variáveis de autenticação ausentes:\n` +
        missing.map((v) => `  - ${v}\n`).join("") +
        "\nConfigure em Vercel → Settings → Environment Variables antes do deploy.\n",
    );
    process.exit(1);
  }
  // 1. Migração SQL (backfill de dados + criação de tabelas). Idempotente.
  execSync("node scripts/migrate.cjs pre", { stdio: "inherit" });
  // 2. drizzle-kit push alinha o schema restante (colunas, defaults, tipos).
  execSync("npm run db:push:ci", { stdio: "inherit" });
  execSync("node scripts/migrate.cjs post", { stdio: "inherit" });
}
execSync("npm run build", { stdio: "inherit" });
