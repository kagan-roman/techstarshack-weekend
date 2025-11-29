import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";

const loadEnvIfExists = (envPath: string) => {
  if (fs.existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
};

const cwdEnvPath = path.resolve(process.cwd(), ".env");
const repoRootEnvPath = path.resolve(__dirname, "../../../../.env");

loadEnvIfExists(repoRootEnvPath);
if (repoRootEnvPath !== cwdEnvPath) {
  loadEnvIfExists(cwdEnvPath);
}

const required = [
  "TAVILY_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_API_BASE",
  "OPENROUTER_DEFAULT_MODEL",
];

for (const variable of required) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable ${variable}`);
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  databaseUrlSession: process.env.DATABASE_URL_SESSION,
  tavilyApiKey: process.env.TAVILY_API_KEY as string,
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY as string,
    apiBase: process.env.OPENROUTER_API_BASE as string,
    defaultModel: process.env.OPENROUTER_DEFAULT_MODEL as string,
  },
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
};
