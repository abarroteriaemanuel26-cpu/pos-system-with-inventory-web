import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

const isTursoConfigured = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
const useLocalDb = !isTursoConfigured;

let client: Client | null = null;
let db: LibSQLDatabase<typeof schema> | null = null;

if (isTursoConfigured) {
  client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
} else {
  // Fallback a SQLite local para desarrollo
  client = createClient({
    url: "file:./data/local.db",
  });
}
db = drizzle(client, { schema });

export function getDb() {
  if (!db) {
    throw new Error("Base de datos no inicializada");
  }
  return db;
}

export function getClient() {
  if (!client) {
    throw new Error("Base de datos no inicializada");
  }
  return client;
}

export function isDatabaseConfigured() {
  return true;
}

export { client, db };
