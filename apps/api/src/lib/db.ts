import postgres from "postgres";
import { env } from "../config/env";

const SCHEMA = "hackathon";

const rawSql = postgres(env.databaseUrl, {
  transform: {
    undefined: null,
  },
});

// Wrapper that prefixes table names with schema
// For now we'll use raw sql and manually prefix tables in queries
export const sql = rawSql;
export const schema = SCHEMA;

// Helper for table names
export const t = (table: string) => `${SCHEMA}.${table}`;
