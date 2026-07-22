import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

/**
 * URL real deve vir de DATABASE_URL. Valor placeholder só para compilar / análise estática;
 * em runtime, sem Neon configurado, as rotas que usam o banco falharão na primeira query.
 */
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?sslmode=disable";

export const sql = neon(connectionString);

export const db: Db = drizzle(sql, { schema });
