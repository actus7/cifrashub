import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

export function createTestDb() {
  const client = new PGlite();
  return { client, db: drizzle(client, { schema }) };
}

/** Runs drizzle/*.sql in order, after creating the Neon Auth-owned table that migrations omit. */
export async function applyMigrations(client: PGlite) {
  await client.exec(
    `CREATE SCHEMA IF NOT EXISTS neon_auth;
     CREATE TABLE IF NOT EXISTS neon_auth."user" (id uuid PRIMARY KEY, name text, email text);`,
  );
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const statements = readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint");
    for (const statement of statements) {
      if (statement.trim()) await client.exec(statement);
    }
  }
}

export async function seedUser(client: PGlite, id: string, name: string, email: string) {
  await client.query(`INSERT INTO neon_auth."user" (id, name, email) VALUES ($1, $2, $3)`, [
    id,
    name,
    email,
  ]);
}

export async function resetDb(client: PGlite) {
  await client.exec(
    `TRUNCATE setlist_stage, folder_member, setlist_member, user_setlist_item, user_setlist, user_song, user_folder, neon_auth."user" CASCADE;`,
  );
}

let sessionUserId: string | null = null;

export function setSession(userId: string | null) {
  sessionUserId = userId;
}

export function currentSession() {
  return sessionUserId ? { user: { id: sessionUserId } } : null;
}

// Shared singleton so vi.mock("@/db") and the tests see the same database.
export const testDb = createTestDb();
export const ready = applyMigrations(testDb.client);
