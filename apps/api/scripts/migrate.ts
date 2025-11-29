import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { config } from "dotenv";

// Load env
config({ path: "../../.env" });
config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(databaseUrl);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, "../migrations");
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration(s)`);

  for (const file of files) {
    const migrationPath = path.join(migrationsDir, file);
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    console.log(`Running ${file}...`);

    try {
      await sql.unsafe(migrationSql);
      console.log(`  ✓ ${file} completed`);
    } catch (error) {
      console.error(`  ✗ ${file} failed:`, error);
      process.exit(1);
    }
  }

  console.log("\nAll migrations completed successfully!");
  await sql.end();
}

runMigrations();
