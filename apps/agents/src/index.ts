import pino from "pino";
import { env } from "./config/env";
import { loadPrompts } from "./lib/promptLoader";
import { getSupabaseAdminClient } from "@weekend/core";

const logger = pino({ name: "weekend-agents" });

const main = async () => {
  const prompts = loadPrompts();
  logger.info({ count: Object.keys(prompts).length }, "Loaded prompts into memory");

  const supabase = getSupabaseAdminClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
    jwtSecret: env.supabaseJwtSecret,
    schema: env.supabaseDbSchema,
  });

  logger.info("Supabase admin client ready");

  // TODO: wire LangGraph deep agents here
  logger.info("Agents bootstrap finished. Waiting for jobs...");

  // Temporary interval to keep process alive and show stub behavior
  setInterval(async () => {
    const { data, error } = await supabase
      .from("agent_runs")
      .select("*")
      .eq("status", "queued")
      .limit(1);

    if (error) {
      logger.error({ err: error }, "Failed to poll agent runs");
      return;
    }

    if (data.length > 0) {
      logger.info({ runId: data[0].id, type: data[0].type }, "Found queued run (not yet processed)");
    }
  }, 10000);
};

void main().catch((error) => {
  logger.error({ err: error }, "Agents process failed");
  process.exit(1);
});

