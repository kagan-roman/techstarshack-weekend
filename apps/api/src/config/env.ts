import path from "node:path";
import { config } from "dotenv";

const envPath = path.resolve(process.cwd(), ".env");
config({ path: envPath });

const requiredVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "SUPABASE_DB_SCHEMA",
];

for (const variable of requiredVars) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable ${variable}`);
  }
}

export const env = {
  supabaseUrl: process.env.SUPABASE_URL as string,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET as string,
  supabaseDbSchema: process.env.SUPABASE_DB_SCHEMA as string,
  port: Number(process.env.PORT ?? 3000),
};

