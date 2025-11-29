import { config } from "dotenv";

// Load .env from repo root (two levels up from apps/api)
config({ path: "../../.env" });
// Also try cwd in case running from root
config();

const requiredVars = ["DATABASE_URL"];

for (const variable of requiredVars) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable ${variable}`);
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  port: Number(process.env.PORT ?? 3000),
};
